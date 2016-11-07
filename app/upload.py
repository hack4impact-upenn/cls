import os
from . import db
from app import create_app
from models import User
from flask import flash
from flask.ext.rq import get_queue
from email import send_email

def send_upload_email(user_id, data):
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        # Query user for email address.
        # Send email with data as body.
        user = User.query.filter_by(id=user_id).first()
        confirm_link = 'TODO'
        get_queue().enqueue(
    		send_email,
            recipient=user.email,
            subject='Location Data Results Ready!',
            template='account/email/results_ready',
            user=user,
            results_link=confirm_link)
        flash('A notification has been sent to {}.'.format(user.email),
              'warning')

def upload_data(data):
	print "upload data"
