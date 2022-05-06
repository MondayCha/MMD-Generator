from flask_admin.contrib.sqla import ModelView
from app import admin, db

from api.models.user import User
from api.models.data_group import DataGroup
from api.models.data import Data

class UserView(ModelView):
    form_columns = ("username", "password", "usertype")


admin.add_view(UserView(User, db.session))
admin.add_view(ModelView(DataGroup, db.session))
admin.add_view(ModelView(Data, db.session))