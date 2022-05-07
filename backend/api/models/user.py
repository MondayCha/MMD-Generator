from app import db, bcrypt
from sqlalchemy.ext.hybrid import hybrid_property
from api.models.annotation import Annotation


class User(db.Model):
    __tablename__ = "user"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    _password = db.Column(db.String, nullable=False)
    usertype = db.Column(db.Integer, nullable=False) # 0: admin, 1: user

    annotations = db.relationship('Annotation', backref='annotator')

    @hybrid_property
    def password(self):
        """Return the hashed user password."""
        return self._password

    @password.setter
    def password(self, new_pass):
        """Salt/Hash and save the user's new password."""
        new_password_hash = bcrypt.generate_password_hash(new_pass)
        self._password = new_password_hash

    def check_password(self, password):
        """Check if the password is correct."""
        return bcrypt.check_password_hash(self.password, password)

    def __repr__(self):
        return '<User %r>' % self.username