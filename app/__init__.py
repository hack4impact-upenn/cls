import os
from flask import Flask
from flask.ext.wtf import CsrfProtect
from flask.ext.compress import Compress

from config import config

basedir = os.path.abspath(os.path.dirname(__file__))

csrf = CsrfProtect()
compress = Compress()


def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    # Set up extensions
    csrf.init_app(app)
    compress.init_app(app)

    # Configure SSL if platform supports it
    if not app.debug and not app.testing and not app.config['SSL_DISABLE']:
        from flask.ext.sslify import SSLify
        SSLify(app)

    # Create app blueprints
    from main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app
