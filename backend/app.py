'''
Author: MondayCha
Date: 2022-04-06 15:44:42
Description: Flask App Entrypoint
'''
import logging
from flask import Flask
from config import Config, SWAGGER_TEMPLATE
from flask_cors import CORS
from flasgger import Swagger
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_marshmallow import Marshmallow
from hashids import Hashids
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView

db = SQLAlchemy()
migrate = Migrate()
ma = Marshmallow()
bcrypt = Bcrypt()
hashids = Hashids(salt=Config.SECRET_KEY, min_length=8)
jwt = JWTManager()
admin = Admin()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)

    # set up instance
    db.init_app(app)
    migrate.init_app(app, db)
    ma.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    admin.init_app(app)
    import api.utils.admin
    swagger = Swagger(app, template=SWAGGER_TEMPLATE)
    CORS(app, supports_credentials=True)

    # routes
    from api.routes import api_router, media_router
    app.register_blueprint(api_router.bp)
    app.register_blueprint(media_router.bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=80)
