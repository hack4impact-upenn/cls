import os

from flask import flash

from . import db
from app import create_app
from email import send_email
from models import User

def send_upload_email(user_id):
    """Sends the user a confirmation that their data has been uploaded."""
    user = User.query.filter_by(id=user_id).first()
    confirm_link = 'TODO'
    send_email(
        recipient=user.email, 
        subject='Location Data Results Ready!',
        template='account/email/results_ready',
        user=user,
        results_link=confirm_link
    )

def upload_data():
    print "upload data"
