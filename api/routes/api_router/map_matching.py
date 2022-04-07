from flask import request, g, current_app
from api.utils.matching_sdk import matching_sdk
from api.utils.request_handler import *
from app import db
from flasgger import swag_from

from . import bp


@bp.route('/matching', methods=['GET'])
@swag_from({
    'responses': {
        HTTPStatus.OK.value: {
            'description': 'map matching',
        }
    }
})
def map_matching():
    """
    Map matching
    """
    if request.method == 'GET':
        matching_sdk_code, matching_sdk_dict = matching_sdk()
        if matching_sdk_code == 1:
            return bad_request(status_code=HTTPStatus.INTERNAL_SERVER_ERROR,ret_status_code=RETStatus.SDK_ERR, detail=matching_sdk_dict)
        return good_request(detail=matching_sdk_dict)
