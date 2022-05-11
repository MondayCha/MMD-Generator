"""
[General Configuration Params]
"""
from os import environ, path
from dotenv import load_dotenv
from datetime import timedelta


basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir, '.env'))

SWAGGER_TEMPLATE = {
    'components': {
        'securitySchemes': {
            'auth': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'Authorization',
                'description': 'A jwt token formatted in `bearer xxxxxxxxxxxxxxxxxxxxxx`'
            }
        },
    },
    'security': [
        {
            'auth': []
        }
    ]
}


class Config(object):
    SECRET_KEY = environ.get('SECRET_KEY') or 'map-matching-dataset-generator'
    JWT_SECRET_KEY = environ.get('JWT_SECRET_KEY') or 'map-matching-dataset-generator'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    UPLOAD_DIR = path.join(basedir, 'media')

    # Map-Matching SDK
    SDK_ENTRYPONIT_PATH = '~/documents/map-matching/map_matching/build/libs/map_matching-all.jar'
    SDK_IEEE_PATH = '~/documents/map-matching-6be1206/map_matching/build/libs/map_matching-all.jar'
    GRAPHHOPPER_LOCATION_PATH = '/tmp/graphhopper'
    OSM_FILE_PATH = '~/documents/mmd-generator/backend/media/osm/beijing2.osm.gz'
    IEEE_2015_PATH = '/home/monday/documents/map-matching-dataset/'
    MATCHING_METHODS = ['STMatching', 'SimpleMapMatching', 'GHMapMatching']

    # SQLALCHEMY
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + path.join(basedir, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # SWAGGER
    # - https://github.com/flasgger/flasgger/blob/master/examples/openapi3_examples.py
    # - https://swagger.io/docs/specification/describing-parameters/
    SWAGGER = {
        'headers': [],
        'title': 'Map-Matching Dataset Generator',
        'version': '0.1.0',
        'openapi': '3.0.3',
        'termsOfService': '',
        'specs': [
            {
                'endpoint': 'apispec',
                'route': '/apispec.json'
            }
        ],
    }