import os

def create_csv(bounding_box, json):
    curr_inbounds = False
    for point in json['locations']:
        latitude = point['latitudeE7'] / math.pow(10, 7)
        longitude = point['longitudeE7'] / math.pow(10, 7)
        if inbounds(bounding_box, latitude, longitude) and not curr_inbounds:
            curr_inbounds = True
            print "enter", point['timestampMs']
        elif not inbounds(bounding_box, latitude, longitude) and curr_inbounds:
            curr_inbounds = False
            print "exit", point['timestampMs']

def inbounds(bounding_box, latitude, longitude):
    return bounding_box.min_lat >= latitude and 
           bounding_box.max_lat <= latitude and
           bounding_box.min_long <= longitude and
           bounding_box.max_long >= longitude
