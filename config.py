"""
[General Configuration Params]
"""
from os import environ, path
from dotenv import load_dotenv


basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir, '.env'))


class Config(object):
    SECRET_KEY = environ.get('SECRET_KEY') or 'map-matching-dataset-generator'
    UPLOAD_DIR = path.join(basedir, 'media')

    # Map-Matching SDK
    SDK_ENTRYPONIT_PATH = '~/Documents/map-matching/map_matching/build/libs/map_matching-all.jar'
    GRAPHHOPPER_LOCATION_PATH = '/tmp/graphhopper'
    OSM_FILE_PATH = '~/Documents/data/beijing2.osm.gz'
    INPUT_PATH = '~/Documents/data/input'
    OUTPUT_PATH = '~/Documents/data/output'

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
        'specs': [
            {
                'endpoint': 'apispec',
                'route': '/apispec.json'
            }
        ],
    }