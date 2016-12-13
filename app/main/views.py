from flask import flash, redirect, render_template, request, url_for, jsonify
from flask.ext.login import (current_user, login_required, login_user,
                             logout_user)
from flask.ext.rq import get_queue
import time
import os, json, boto3
from . import main
from app import csrf

@main.route('/')
def index():
    return render_template('main/map.html')

@csrf.exempt
@main.route('/analyze/', methods=["POST"])
def analyze():
    data = json.loads(request.form['json'])
    print data
    return jsonify({'status':'OK'});

@main.route('/sign-s3/')
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
