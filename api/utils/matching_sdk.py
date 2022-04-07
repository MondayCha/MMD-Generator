from flask import current_app
from api.utils.os_helper import cmd
from api.utils.request_handler import *

def matching_sdk():
    """
    Map matching
    ---
    """
    matching_methods = ['GHMapMatching', 'SimpleMapMatching', 'STMatching']

    # call sdk to compress and decompress
    for matching_method in matching_methods:
        matching_cmd = 'java -cp %s com.example.MatchingMain --graphHopperLocation %s --osmFile %s --output %s --matcher %s %s' % (
            current_app.config.get('SDK_ENTRYPONIT_PATH'), current_app.config.get('GRAPHHOPPER_LOCATION_PATH'), 
            current_app.config.get('OSM_FILE_PATH'), current_app.config.get('OUTPUT_PATH'), 
            matching_method, current_app.config.get('INPUT_PATH'))
        current_app.logger.debug(matching_cmd)
        matching_code, matching_dict = cmd(matching_cmd)
        if matching_code == 1:
            current_app.logger.debug(matching_dict['stderr'])
            return 1, matching_dict['stderr']
    return 0, matching_dict['stdout']
