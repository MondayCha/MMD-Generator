from flask import current_app, g
from api.utils.os_helper import *
from api.utils.request_handler import *

def matching_sdk():
    """
    Map matching
    ---
    """
    matching_methods = current_app.config.get('MATCHING_METHODS') or ['GHMapMatching', 'SimpleMapMatching', 'STMatching']
    current_task_id = g.task.id
    input_path = get_input_path(current_task_id)
    output_path = get_output_path(current_task_id)

    # call sdk to compress and decompress
    for matching_method in matching_methods:
        matching_cmd = 'java -cp %s com.example.MatchingMain --graphHopperLocation %s --osmFile %s --output %s --matcher %s %s' % (
            current_app.config.get('SDK_ENTRYPONIT_PATH'), current_app.config.get('GRAPHHOPPER_LOCATION_PATH'), 
            current_app.config.get('OSM_FILE_PATH'), output_path, matching_method, input_path)
        current_app.logger.debug(matching_cmd)
        matching_code, matching_dict = cmd(matching_cmd)
        if matching_code == 1:
            current_app.logger.debug(matching_dict['stderr'])
            return 1, matching_dict['stderr']
    return 0, matching_dict['stdout']
