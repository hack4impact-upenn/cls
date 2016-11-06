import os
from . import db
from app import create_app
from models import User

def send_upload_email(user_id, data):
    app = create_app(os.getenv('FLASK_CONFIG') or 'default')
    with app.app_context():
        # Query user for email address.
        # Send email with data as body.
