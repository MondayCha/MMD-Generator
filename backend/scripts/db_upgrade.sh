#!/bin/bash
flask db init
flask db migrate -m "init"
flask db upgrade