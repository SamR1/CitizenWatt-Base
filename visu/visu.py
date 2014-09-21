#!/usr/bin/env python3

import requests

from math import sin
from random import random
from json import dumps

from bottle import abort, Bottle, SimpleTemplate, static_file, redirect, request, run
from bottle.ext import sqlalchemy
from bottlesession import PickleSession, authenticator
from sqlalchemy import create_engine, Column, DateTime, event, Float, ForeignKey, Integer, Text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

def to_dict(model):
    """ Returns a JSON representation of an SQLAlchemy-backed object.
    TODO : Use runtime inspection API
    From https://zato.io/blog/posts/converting-sqlalchemy-objects-to-json.html
    """
    dict = {}
    dict['id'] = getattr(model, 'id')

    for col in model._sa_class_manager.mapper.mapped_table.columns:
        dict[col.name] = getattr(model, col.name)

    return dict

n_values = 0
def generate_value():
    """Generate values for debug purpose"""
    global n_values
    MAX_POWER = 3500
    n_values += 1
    return sin(n_values / 10.0) ** 2 * MAX_POWER
    return random() * MAX_POWER

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

Base = declarative_base()
engine = create_engine("sqlite:///tmp.db", echo=True)

app = Bottle()
plugin = sqlalchemy.Plugin(
    engine,
    Base.metadata,
    keyword='db',
    create=True,
    commit=True,
    use_kwargs=False
)
app.install(plugin)

session_manager = PickleSession()
valid_user = authenticator(session_manager, login_url='/login')

# DB Structure

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)
    type_id = Column(Integer,
                     ForeignKey("measures_types.id", ondelete="CASCADE"),
                     nullable=False)
    measures = relationship("Measures", passive_deletes=True)
    type = relationship("MeasureType", lazy="joined")


class Measures(Base):
    __tablename__ = "measures"
    id = Column(Integer, primary_key=True)
    sensor_id = Column(Integer,
                       ForeignKey("sensors.id", ondelete="CASCADE"),
                       nullable=False)
    value = Column(Float)
    timestamp = Column(DateTime)


class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)
    type_id = Column(Integer,
                     ForeignKey("measures_types.id", ondelete="CASCADE"),
                     nullable=False)
    slope_watt_euros = Column(Float)
    constant_watt_euros = Column(Float)
    current = Column(Integer)


class MeasureType(Base):
    __tablename__ = "measures_types"
    id = Column(Integer, primary_key=True)
    name = Column(Text, unique=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    login = Column(Text, unique=True)
    password = Column(Text)
    is_admin = Column(Integer)


# Useful functions
def update_providers(db):
    json = requests.get("http://pub.phyks.me/tmp/electricity_providers.json")
    db.query(Provider).delete()
    providers = json.json()
    for provider in providers:
        provider_db = Provider(name=provider["name"],
                               constant_watt_euros=provider["constant_watt_euros"],
                               slope_watt_euros=provider["slope_watt_euros"],
                               type_id=provider["type_id"])
        db.add(provider_db)
    return providers


# API
@app.route("/api/sensors", apply=valid_user())
def api_sensors(db):
    sensors = db.query(Sensor).all()
    if sensors:
        sensors = [{"id": sensor.id,
                    "name": sensor.name,
                    "type": sensor.type.name,
                    "type_id": sensor.type_id
                } for sensor in sensors]
        return {"data": sensors}
    else:
        abort(404, "No sensors found.")

@app.route("/api/<sensor:int>/get/<watt_euros:re:watts|euros>/by_id/<id1:int>", apply=valid_user())
def api_get_id(sensor, watt_euros, id1, db):
    # DEBUG
    data = [{"power": generate_value()} for i in range(id1)]
    if watt_euros == "euros":
        data = [api_watt_euros(0, i["power"], db) for i in data]
    return {"data": data}
    # /DEBUG

    if id1 >= 0:
        data = db.query(Measures).filter_by(sensor_id=sensor,
                                            id=id1).first()
    else:
        data = db.query(Measures).filter_by(sensor_id=sensor).order_by(desc(Measures.id)).slice(id1, id1)

    if data:
        data = to_dict(data)
        if watt_euros == "euros":
            data = [api_watt_euros(0, i["power"]) for i in data]
        return {"data": data}
    else:
        abort(404,
              "No measures with id " + str(id1)  +
              " found for sensor " + str(sensor) + ".")

@app.route("/api/<sensor:int>/get/<watt_euros:re:watts|euros>/by_id/<id1:int>/<id2:int>", apply=valid_user())
def api_get_ids(sensor, watt_euros, id1, id2, db):
    # DEBUG
    data = [{"power": generate_value()} for i in range(id2)]
    if watt_euros == "euros":
        data = [api_watt_euros(0, i["power"], db) for i in data]
    return {"data": data}
    # /DEBUG

    if id1 >= 0 and id2 >= 0 and id2 >= id1:
        data = db.query(Measures).filter(sensor_id == sensor,
                                         id >= id1,
                                         id <= id2).all()
    elif id1 <= 0 and id2 <= 0 and id1 >= id2:
        data = db.query(Measures).filter_by(sensor_id=sensor).order_by(desc(Measures.id)).slice(-id1, -id2)
    else:
        abort(404, "Wrong parameters id1 and id2.")

    if data:
        data = to_dict(data)
        if watt_euros == 'euros':
            data = [api_watt_euros(0, i["power"]) for i in data]
        return {"data": data}
    else:
        abort(404,
              "No relevant measures found.")

@app.route("/api/<sensor:int>/get/<watt_euros:re:watts|euros>/by_time/<time1:float>", apply=valid_user())
def api_get_time(sensor, watt_euros, time1, db):
    if time1 < 0:
        abort(404, "Invalid timestamp.")

    # DEBUG
    data = [{"power": generate_value()} for i in range(int(time1))]
    if watt_euros == "euros":
        data = [api_watt_euros(0, i["power"], db) for i in data]
    return {"data": data}
    # /DEBUG

    data = db.query(Measures).filter_by(sensor_id=sensor,
                                        timestamp=time1).first()
    if data:
        data = to_dict(data)
        if watt_euros == 'euros':
            data = [api_watt_euros(0, i["power"]) for i in data]
        return {"data": data}
    else:
        abort(404,
              "No measures at timestamp " + str(time1) +
              " found for sensor " + str(sensor) + ".")

@app.route("/api/<sensor:int>/get/<watt_euros:re:watts|euros>/by_time/<time1:float>/<time2:float>",
           apply=valid_user())
def api_get_times(sensor, watt_euros, time1, time2, db):
    if time1 < 0 or time2 < time1:
        abort(404, "Invalid timestamps.")

    # DEBUG
    data = [{"power": generate_value()} for i in range(int(time2))]
    if watt_euros == "euros":
        data = [api_watt_euros(0, i["power"], db) for i in data]
    return {"data": data}
    # /DEBUG

    data = db.query(Measures).filter(sensor_id == sensor,
                                     timestamp >= time1,
                                     timestamp <= time2).all()
    if data:
        data = to_dict(data)
        if watt_euros == 'euros':
            data = [api_watt_euros(0, i["power"]) for i in data]
        return {"data": data}
    else:
        abort(404,
              "No measures between timestamp " + str(time1) +
              " and timestamp " + str(time2) +
              " found for sensor " + str(sensor) + ".")

@app.route("/api/energy_providers", apply=valid_user())
def api_energy_providers(db):
    providers = db.query(Provider).all()
    if providers:
        return {"data": [to_dict(provider) for provider in providers]}
    else:
        abort(404, 'No providers found.')

@app.route("/api/<energy_provider:int>/watt_euros/<consumption:float>",
           apply=valid_user())
def api_watt_euros(energy_provider, consumption, db):
    if energy_provider != 0:
        provider = db.query(Provider).filter_by(id=energy_provider).first()
    else:
        provider = db.query(Provider).filter_by(current=1).first()
    if provider:
        return {"data": provider.slope_watt_euros * consumption + provider.constant_watt_euros}
    else:
        abort(404, 'No matching provider found.')

# Routes
@app.route("/static/<filename:path>", name="static")
def static(filename):
    return static_file(filename, root="static")


@app.route('/', name="index", template="index", apply=valid_user())
def index():
    return {}


@app.route("/conso", name="conso", template="conso", apply=valid_user())
def conso(db):
    provider = db.query(Provider).filter_by(current=1).first()
    return {"provider": provider.name}

@app.route("/settings", name="settings", template="settings")
def settings(db):
    sensors = db.query(Sensor).all()
    if sensors:
        sensors = [{"id": sensor.id,
                    "name": sensor.name,
                    "type": sensor.type.name,
                    "type_id": sensor.type_id
                } for sensor in sensors]
    else:
        sensors = []

    providers = update_providers(db)

    return {"sensors": sensors, "providers": providers}

@app.route("/settings",
           name="settings",
           apply=valid_user(),
           method="post")
def settings_post(db):
    password = request.forms.get("password").strip()
    password_confirm = request.forms.get("password_confirm")

    if password:
        if password == password_confirm:
            session = session_manager.get_session()
            user = (db.query(User).filter_by(login=session["login"]).
                    update({"password": password},  synchronize_session=False))
        else:
            abort(400, "Les mots de passe ne sont pas identiques.")

    provider = request.forms.get("provider")
    provider = (db.query(Provider).filter_by(name=provider).\
                update({"current":1}))

    redirect("/settings")

@app.route("/results", name="results", template="results")
def results():
    return {}

@app.route("/help", name="help", template="help")
def help():
    return {}


@app.route("/login", name="login", template="login")
def login(db):
    if not db.query(User).all():
        redirect("/install")
    session = session_manager.get_session()
    if session['valid'] is True:
        redirect('/')
    else:
        return {"login": ''}


@app.route("/login", name="login", template="login", method="post")
def login(db):
    login = request.forms.get("login")
    user = db.query(User).filter_by(login=login).first()
    session = session_manager.get_session()
    session['valid'] = False
    session_manager.save(session)
    if user and user.password == request.forms.get("password"):
        session['valid'] = True
        session['login'] = login
        session['is_admin'] = user.is_admin
        session_manager.save(session)
        redirect('/')
    else:
        return {
            "login": login,
            "err": {
                "title": "Identifiants incorrects.",
                "content": "Aucun utilisateur n'est enregistré à ce nom." if user else "Mot de passe erroné."
            }
        }


@app.route("/logout", name="logout")
def logout():
    session = session_manager.get_session()
    session['valid'] = False
    del(session['login'])
    del(session['is_admin'])
    session_manager.save(session)
    redirect('/')


@app.route("/install", name="install", template="install")
def install(db):
    if db.query(User).all():
        redirect('/')

    db.query(MeasureType).delete()
    db.query(Provider).delete()
    db.query(Sensor).delete()

    electricity_type = MeasureType(name="Électricité")
    db.add(electricity_type)
    db.flush()

    providers = update_providers(db)

    sensor = Sensor(name="CitizenWatt",
                    type_id=electricity_type.id)
    db.add(sensor)

    return {"login": '', "providers": providers}

@app.route("/install", name="install", template="install", method="post")
def install_post(db):
    try:
        if db.query(User).all():
            redirect('/')
    except OperationnalError:
        redirect('/')

    login = request.forms.get("login").strip()
    password = request.forms.get("password").strip()
    password_confirm = request.forms.get("password_confirm")
    provider = request.forms.get("provider")

    if login and password and password == password_confirm:
        admin = User(login=login, password=password, is_admin=1)
        db.add(admin)

        provider = (db.query(Provider).filter_by(name=provider).\
                    update({"current":1}))

        redirect('/')
    else:
        return {"login": login}

SimpleTemplate.defaults["get_url"] = app.get_url
SimpleTemplate.defaults["API_URL"] = app.get_url("index")
SimpleTemplate.defaults["valid_session"] = lambda : session_manager.get_session()['valid']
run(app, host="0.0.0.0", port=8080, debug=True, reloader=True)
