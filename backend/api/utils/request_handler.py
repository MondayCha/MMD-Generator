from flask import jsonify
from http import HTTPStatus
from enum import IntEnum


class RETStatus(IntEnum):
    """
    Custom return status code in json body
    """
    def __new__(cls, value, description=''):
        obj = int.__new__(cls, value)
        obj._value_ = value
        obj.description = description
        return obj

    # informational
    SUCCESS = 20000, 'Operation succeed'
    JSON_INVALID = 40001, 'JSON invalid'
    DATA_INVALID = 40002, 'Data invalid'
    JWT_INVALID = 40101, 'JWT invalid'
    AUTH_ERR = 40102, 'Error authentication'
    PATH_INVALID = 40401, 'Path invalid'
    PARAM_INVALID = 40402, 'Param invalid'
    GENERAL_OTHER_ERR = 40500, 'General other error'
    SDK_ERR = 50001, 'SDK error'
    FILE_SYSTEM_ERR = 50002, 'File system error'


def good_request(detail=None):
    data = {
            'status_code': RETStatus.SUCCESS,
            'detail': detail or RETStatus.SUCCESS.description,
        }
    response = jsonify(data)
    response.status_code = HTTPStatus.OK
    return response

def bad_request(ret_status_code=RETStatus.GENERAL_OTHER_ERR, status_code=HTTPStatus.BAD_REQUEST, detail=None):
    data = {
            'status_code': ret_status_code,
            'detail': detail or RETStatus(ret_status_code).description or HTTPStatus.BAD_REQUEST.description,
        }
    response = jsonify(data)
    response.status_code = status_code
    return response
