#!/usr/bin/env python
import os
import subprocess

from config import Config

from flask.ext.script import Manager, Shell

from app import create_app

if os.path.exists('.env'):
    print('Importing environment from .env file')
    for line in open('.env'):
        var = line.strip().split('=')
        if len(var) == 2:
            os.environ[var[0]] = var[1]

app = create_app(os.getenv('FLASK_CONFIG') or 'default')
manager = Manager(app)


def make_shell_context():
    return dict(app=app)


manager.add_command('shell', Shell(make_context=make_shell_context))

@manager.command
def format():
    """Runs the yapf and isort formatters over the project."""
    isort = 'isort -rc *.py app/'
    yapf = 'yapf -r -i *.py app/'

    print 'Running {}'.format(isort)
    subprocess.call(isort, shell=True)

    print 'Running {}'.format(yapf)
    subprocess.call(yapf, shell=True)


if __name__ == '__main__':
    manager.run()
