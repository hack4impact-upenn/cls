from flask import render_template, request, url_for
import time
import os, json, boto3
from . import main
from app import csrf
import hashlib

@main.route('/')
def index():
    return render_template('main/map.html')

@main.route('/sign-s3/')
def sign_s3():
  # Load necessary information into the application
  S3_BUCKET = os.environ.get('S3_BUCKET')
  S3_REGION = os.environ.get('S3_REGION')
  TARGET_FOLDER = 'json'
  # Load required data from the request
  file_type = request.args.get('file-type')
  pre_file_name = request.args.get('file-name') 
  file_name = ''.join(hashlib.sha224(pre_file_name).hexdigest()) + str(time.time()).replace('.','') + '.' + ''.join(file_type)

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
