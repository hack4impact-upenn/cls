from datetime import datetime
from flask import flash, redirect, render_template, request, url_for, jsonify
from flask.ext.login import (current_user, login_required, login_user,
                             logout_user)
from flask.ext.rq import get_queue
import requests
import time
import os, json, boto3
from . import account
from .. import db
from ..email import send_email
from ..models import User
from .forms import (ChangeEmailForm, ChangePasswordForm, CreatePasswordForm,
                    LoginForm, RegistrationForm, RequestResetPasswordForm,
                    ResetPasswordForm)
from app import csrf

@account.route('/login', methods=['GET', 'POST'])
def login():
    """Log in an existing user."""
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is not None and user.password_hash is not None and \
                user.verify_password(form.password.data):
            login_user(user, form.remember_me.data)
            flash('You are now logged in. Welcome back!', 'success')
            return redirect(request.args.get('next') or url_for('main.index'))
        else:
            flash('Invalid email or password.', 'form-error')
    return render_template('account/login.html', form=form)

@account.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.index'))


@account.route('/manage', methods=['GET', 'POST'])
@account.route('/manage/info', methods=['GET', 'POST'])
@login_required
def manage():
    """Display a user's account information."""
    return render_template('account/manage.html', user=current_user, form=None)


@account.route('/reset-password', methods=['GET', 'POST'])
def reset_password_request():
    """Respond to existing user's request to reset their password."""
    if not current_user.is_anonymous():
        return redirect(url_for('main.index'))
    form = RequestResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            token = user.generate_password_reset_token()
            reset_link = url_for(
                'account.reset_password', token=token, _external=True)
            get_queue().enqueue(
                send_email,
                recipient=user.email,
                subject='Reset Your Password',
                template='account/email/reset_password',
                user=user,
                reset_link=reset_link,
                next=request.args.get('next'))
        flash('A password reset link has been sent to {}.'
              .format(form.email.data), 'warning')
        return redirect(url_for('account.login'))
    return render_template('account/reset_password.html', form=form)


@account.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """Reset an existing user's password."""
    if not current_user.is_anonymous():
        return redirect(url_for('main.index'))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is None:
            flash('Invalid email address.', 'form-error')
            return redirect(url_for('main.index'))
        if user.reset_password(token, form.new_password.data):
            flash('Your password has been updated.', 'form-success')
            return redirect(url_for('account.login'))
        else:
            flash('The password reset link is invalid or has expired.',
                  'form-error')
            return redirect(url_for('main.index'))
    return render_template('account/reset_password.html', form=form)


@account.route('/manage/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    """Change an existing user's password."""
    form = ChangePasswordForm()
    if form.validate_on_submit():
        if current_user.verify_password(form.old_password.data):
            current_user.password = form.new_password.data
            db.session.add(current_user)
            db.session.commit()
            flash('Your password has been updated.', 'form-success')
            return redirect(url_for('main.index'))
        else:
            flash('Original password is invalid.', 'form-error')
    return render_template('account/manage.html', form=form)


@account.route('/manage/change-email', methods=['GET', 'POST'])
@login_required
def change_email_request():
    """Respond to existing user's request to change their email."""
    form = ChangeEmailForm()
    if form.validate_on_submit():
        if current_user.verify_password(form.password.data):
            new_email = form.email.data
            token = current_user.generate_email_change_token(new_email)
            change_email_link = url_for(
                'account.change_email', token=token, _external=True)
            get_queue().enqueue(
                send_email,
                recipient=new_email,
                subject='Confirm Your New Email',
                template='account/email/change_email',
                # current_user is a LocalProxy, we want the underlying user
                # object
                user=current_user._get_current_object(),
                change_email_link=change_email_link)
            flash('A confirmation link has been sent to {}.'.format(new_email),
                  'warning')
            return redirect(url_for('main.index'))
        else:
            flash('Invalid email or password.', 'form-error')
    return render_template('account/manage.html', form=form)


@account.route('/manage/change-email/<token>', methods=['GET', 'POST'])
@login_required
def change_email(token):
    """Change existing user's email with provided token."""
    if current_user.change_email(token):
        flash('Your email address has been updated.', 'success')
    else:
        flash('The confirmation link is invalid or has expired.', 'error')
    return redirect(url_for('main.index'))


@account.route('/confirm-account')
@login_required
def confirm_request():
    """Respond to new user's request to confirm their account."""
    token = current_user.generate_confirmation_token()
    confirm_link = url_for('account.confirm', token=token, _external=True)
    get_queue().enqueue(
        send_email,
        recipient=current_user.email,
        subject='Confirm Your Account',
        template='account/email/confirm',
        # current_user is a LocalProxy, we want the underlying user object
        user=current_user._get_current_object(),
        confirm_link=confirm_link)
    flash('A new confirmation link has been sent to {}.'.format(
        current_user.email), 'warning')
    return redirect(url_for('main.index'))


@account.route('/confirm-account/<token>')
@login_required
def confirm(token):
    """Confirm new user's account with provided token."""
    if current_user.confirmed:
        return redirect(url_for('main.index'))
    if current_user.confirm_account(token):
        flash('Your account has been confirmed.', 'success')
    else:
        flash('The confirmation link is invalid or has expired.', 'error')
    return redirect(url_for('main.index'))


@account.route(
    '/join-from-invite/<int:user_id>/<token>', methods=['GET', 'POST'])
def join_from_invite(user_id, token):
    """
    Confirm new user's account with provided token and prompt them to set
    a password.
    """
    if current_user is not None and current_user.is_authenticated():
        flash('You are already logged in.', 'error')
        return redirect(url_for('main.index'))

    new_user = User.query.get(user_id)
    if new_user is None:
        return redirect(404)

    if new_user.password_hash is not None:
        flash('You have already joined.', 'error')
        return redirect(url_for('main.index'))

    if new_user.confirm_account(token):
        form = CreatePasswordForm()
        if form.validate_on_submit():
            new_user.password = form.password.data
            db.session.add(new_user)
            db.session.commit()
            flash('Your password has been set. After you log in, you can '
                  'go to the "Your Account" page to review your account '
                  'information and settings.', 'success')
            return redirect(url_for('account.login'))
        return render_template('account/join_invite.html', form=form)
    else:
        flash('The confirmation link is invalid or has expired. Another '
              'invite email with a new link has been sent to you.', 'error')
        token = new_user.generate_confirmation_token()
        invite_link = url_for(
            'account.join_from_invite',
            user_id=user_id,
            token=token,
            _external=True)
        get_queue().enqueue(
            send_email,
            recipient=new_user.email,
            subject='You Are Invited To Join',
            template='account/email/invite',
            user=new_user,
            invite_link=invite_link)
    return redirect(url_for('main.index'))


@account.before_app_request
def before_request():
    """Force user to confirm email before accessing login-required routes."""
    if current_user.is_authenticated() \
            and not current_user.confirmed \
            and request.endpoint[:8] != 'account.' \
            and request.endpoint != 'static':
        return redirect(url_for('account.unconfirmed'))


@account.route('/unconfirmed')
def unconfirmed():
    """Catch users with unconfirmed emails."""
    if current_user.is_anonymous() or current_user.confirmed:
        return redirect(url_for('main.index'))
    return render_template('account/unconfirmed.html')


@account.route("/upload/")
def upload():
  # Show the account-edit HTML page:
  return render_template('account/upload.html')

@csrf.exempt
@account.route('/analyze/', methods=["POST"])
def analyze():
    data = json.loads(request.form['json'])
    print "Submitted:"
    print data
    start = data['dayStart'] # 0 - 7
    end = data['dayEnd'] # 0 - 7
    url = data['url']
    rq = get_queue()
    request_job = rq.enqueue(requests.get, url)
    create_csv_job = rq.enqueue(create_csv, start, end, boxes,
                                request_job.result, depends_on=request_job)
    return jsonify({'status':'OK'});

def create_csv(start, end, bounding_boxes, location_request):
    location_json = location_request.json()
    # Stores flag for if we are currently in the box.
    inside = [False] * len(bounding_boxes)
    # Stores the start time of current interval in the box.
    start_times = [None] * len(bounding_boxes)
    # Stores the sum of time in a box over a week.
    durations = [0] * len(bounding_boxes)
    # Checks if a timestamp is during the work week.
    during_week = False
    for point in location_data['locations']:
        print point
        time = point['timestampMs']
        if during_week == in_week(time, start, end):
            continue
        # End of the week.
        elif during_week:
            write_to_csv(durations, bounding_boxes)
            durations = [0] * len(bounding_boxes)
        # Adjust week flag.
        during_week = in_week(time, start, end)
        latitude = point['latitudeE7'] / math.pow(10, 7)
        longitude = point['longitudeE7'] / math.pow(10, 7)
        # Iterate through boxes.
        for i in range(len(bounding_boxes)):
            box = bounding_boxes[i]
            # Enter a bounding box.
            if inbounds(bounding_box, latitude, longitude) and \
                    not inside[i]:
                inside[i] = True
                start_times[i] = time
            # Exit a bounding box.
            elif not inbounds(bounding_box, latitude, longitude) and \
                    inside[i]:
                inside[i] = False
                durations[i] += time - start_times[i]

def inbounds(bounding_box, latitude, longitude):
    return bounding_box['swLat'] <= latitude and \
           bounding_box['neLat'] >= latitude and \
           bounding_box['swLng'] <= longitude and \
           bounding_box['neLng'] >= longitude

def in_week(time, start, end):
    current_day = datetime.fromtimestamp(time).weekday()
    start_day = datetime.fromtimestamp(start).weekday()
    end_day = datetime.fromtimestamp(end).weekday()
    if start_day < end_day:
        return current_day >= start_day and current_day <= end_day
    else:
        return current_day <= start_day and current_day >= end_day

def write_to_csv(durations, bounding_boxes):
    for i in range(len(bounding_boxes)):
        # TODO: Write to a file
        print bounding_boxes[i]['name'], durations[i]

@account.route('/sign-s3/')
def sign_s3():
  # Load necessary information into the application
  S3_BUCKET = os.environ.get('S3_BUCKET')
  S3_REGION = os.environ.get('S3_REGION')
  TARGET_FOLDER = 'json'
  # Load required data from the request
  pre_file_name = request.args.get('file-name') 
  file_name = ''.join(pre_file_name.split('.')[:-1]) + str(time.time()).replace('.','-') + '.' + ''.join(pre_file_name.split('.')[-1:])
  file_type = request.args.get('file-type')

  # Initialise the S3 client
  s3 = boto3.client('s3', 'us-west-2')

  # Generate and return the presigned URL
  presigned_post = s3.generate_presigned_post(
    Bucket = S3_BUCKET,
    Key = TARGET_FOLDER + "/" + file_name,
    Fields = {"acl": "public-read", "Content-Type": file_type},
    Conditions = [
      {"acl": "public-read"},
      {"Content-Type": file_type}
    ],
    ExpiresIn = 6000
  )

  print "presigned_post: "
  print presigned_post
  # Return the data to the client
  return json.dumps({
    'data': presigned_post,
    'url_upload': 'https://%s.%s.amazonaws.com' % (S3_BUCKET, S3_REGION),
    'url': 'https://%s.%s.amazonaws.com/%s/%s' % (S3_BUCKET, S3_REGION, TARGET_FOLDER, file_name)
  })

