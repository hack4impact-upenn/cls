from flask import flash, redirect, render_template, request, url_for, jsonify
from flask.ext.login import (current_user, login_required, login_user,
                             logout_user)
from flask.ext.rq import get_queue
import time
import os, json, boto3, requests
from . import main
from app import csrf

@main.route('/')
def index():
    return render_template('main/map.html')

@csrf.exempt
@main.route('/analyze/', methods=["POST"])
def analyze():
    print request.form['json']
    data = json.loads(request.form['json'])
    print "Submitted:"
    print data
    start = data['dayStart'] # Monday: 0 - 6 
    end = data['dayEnd'] # 0 - 6 
    url = data['url']
    email = data['email']
    boxes = data['boxes']
    rq = get_queue()
    request_job = rq.enqueue(requests.get, url)
    print "RESULT:" + request_job
    create_csv_job = rq.enqueue(create_csv, start, end, boxes, 
                                request_job.result, depends_on=request_job)
    return jsonify({'status':'OK'})

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
    for point in location_json['locations']:
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
