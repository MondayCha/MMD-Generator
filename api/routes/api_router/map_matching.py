from flask import request, g, current_app
from app import db
from flasgger import swag_from

from . import bp


@bp.route('/matching', methods=['GET'])
@swag_from({
    'responses': {
        200: {
            'description': 'compress image',
        }
    }
})
def compress_image():
    """
    [WIP] compress images
    ---
    """
    if request.method == 'GET':
        return {1:1}
