from flask import current_app, g
from api.utils.os_helper import *
from api.utils.request_handler import *

def matching_for_group(osm_path: str):
    """
    Map matching
    ---
    """
    matching_methods = current_app.config.get('MATCHING_METHODS') or ['GHMapMatching', 'SimpleMapMatching', 'STMatching']
    current_group_id = g.group.id
    input_path = get_input_path(current_group_id)
    output_path = get_output_path(current_group_id)

    # call sdk to matching
    for matching_method in matching_methods:
        matching_cmd = 'java -cp %s com.example.MatchingMain --graphHopperLocation %s --osmFile %s --output %s --matcher %s %s' % (
            current_app.config.get('SDK_ENTRYPONIT_PATH'), current_app.config.get('GRAPHHOPPER_LOCATION_PATH'), 
            osm_path, output_path, matching_method, input_path)
        current_app.logger.debug(matching_cmd)
        matching_code, matching_dict = cmd(matching_cmd)
        if matching_code == 1:
            current_app.logger.debug(matching_dict['stderr'])
            return 1, matching_dict['stderr']
    return 0, matching_dict['stdout']


def matching_for_data(osm_path: str, input_path: str, output_path: str):
    matching_methods = current_app.config.get('MATCHING_METHODS') or ['GHMapMatching', 'SimpleMapMatching', 'STMatching']
    # call sdk to matching
    for matching_method in matching_methods:
        matching_cmd = 'java -cp %s com.example.MatchingMain --graphHopperLocation %s --osmFile %s --output %s --matcher %s %s' % (
            current_app.config.get('SDK_ENTRYPONIT_PATH'), current_app.config.get('GRAPHHOPPER_LOCATION_PATH'), 
            osm_path, output_path, matching_method, input_path)
        current_app.logger.debug(matching_cmd)
        matching_code, matching_dict = cmd(matching_cmd)
        if matching_code == 1:
            current_app.logger.debug(matching_dict['stderr'])
            return 1, matching_dict['stderr']
    return 0, matching_dict['stdout']
