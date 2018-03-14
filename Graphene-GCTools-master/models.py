"""
Entirely a SQLAlchemy file. The database is defined using SQLAlchemy and, using the
SQLAlchemy functions.

The entire file should be somewhat self explanatory, but I will comment
where necessary.
"""


from sqlalchemy import *
from sqlalchemy.orm import (scoped_session, sessionmaker, relationship, backref, column_property, foreign)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import select
import gcconnex as gc
from getpass import getpass
import code



def create_engine_connection():
    """
    Copy and paste from the GCconnex file.
    This makes it so you actually need to have
    the credentials to log in.
    """
    username = getpass("Username")
    password = getpass("Password")
    database = getpass("Database Name")
    db_connection = "mysql+pymysql://{}:{}@192.168.1.99:3306/{}".format(
        username, password, database)
    
    # Uses the string formed from above to connect to the database
    engine = create_engine(db_connection, encoding='latin1', echo=False)

    return engine


engine = create_engine_connection()

# This does something
db_session = scoped_session(sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
))

# This also does something
Base = declarative_base()
Base.query = db_session.query_property()


class Entities(Base):
    """
    Mapping out the Entities table
    """
    __tablename__ = 'elggentities'
    guid = Column(Integer, primary_key=True)
    type = Column(String)
    subtype = Column(Integer)
    # Site guid omitted
    owner_guid = Column(Integer)
    container_guid = Column(Integer)
    access_id = Column(Integer)
    time_created = Column(Integer)
    time_updated = Column(Integer)
    last_action = Column(Integer)

class Relationships(Base):
    """
    Mapping out the relationships table
    """
    __tablename__ = 'elggentity_relationships'
    id = Column(Integer, primary_key=True)
    guid_one = Column(Integer)
    guid_two = Column(Integer)
    time_created = Column(Integer)
    relationship = Column(String)

class ObjectsEntity(Base):
    """
    Mapping out the Objects_entity table
    """
    __tablename__ = 'elggobjects_entity'

    guid = Column(Integer, primary_key=True)
    title = Column(String)
    description = Column(String)

class Subtypes(Base):
    """
    Mapping out the subtypes table
    """
    __tablename__ = 'elggentity_subtypes'
    id = Column(Integer, primary_key=True)
    type = Column(String)
    subtype = Column(String)

class Metadata(Base):
    """
    Mapping out the Metadata table
    """
    __tablename__ = 'elggmetadata'
    id = Column(Integer, primary_key=True)
    entity_guid = Column(Integer)
    name_id = Column(Integer)
    value_id = Column(Integer)
    owner_guid = Column(Integer)
    access_id = Column(Integer)
    time_created = Column(Integer)

class Metastrings(Base):
    """
    Mapping out the Metastrings table
    """
    __tablename__ = 'elggmetastrings'
    id = Column(Integer, primary_key=True)
    string = Column(String)

class Annotations(Base):
    """
    Mapping out the Annotations table
    """
    __tablename__ = 'elggannotations'
    id = Column(Integer, primary_key=True)
    entity_guid = Column(Integer)
    name_id = Column(Integer)
    value_id = Column(Integer)
    owner_guid = Column(Integer)
    access_id = Column(Integer)
    time_created = Column(Integer)

class Users(Base):
    """
    Mapping out the Users table.

    Through SQLAlchemy, you can add
    a pseudo-ish column that is a query.

    I found it was easier to add in the department
    feature in the SQLAlchemy models than to clutter
    up the schema any more than it needed to be.

    Because department and job only ever have one
    entry per user, it was possible to just select a max
    of the row that corresponds to those entries
    """
    __tablename__ = 'elggusers_entity'
    guid = Column(Integer, primary_key=True)
    name = Column(String)
    username = Column(String)
    language = column(String)
    last_action = Column(Integer)
    prev_last_action = Column(Integer)
    last_login = Column(Integer)
    prev_last_login = Column(Integer)
    # Switch out integer tags for names

    """
    SQL Version of Department Query:

    SELECT max(ms.string)
    FROM elggmetastrings ms,
         elggmetadata md,
         elggusers_entity ue
    WHERE md.entity_guid = ue.guid
    AND   md.name_id = 8667
    AND   ms.id = md.value_id
    AND   ue.guid = [USER GUID]
    """
    department = column_property(
        select([func.max(Metastrings.string)]).\
        where(
            (Metadata.entity_guid == guid) &
            (Metadata.name_id == 8667) &
            (Metastrings.id == Metadata.value_id)
        )
    )

    """
    SQL Version of Job Query:
    SELECT max(ms.string)
    FROM elggmetastrings ms,
         elggmetadata md,
         elggusers_entity ue
    WHERE md.entity_guid = [USER GUID]
    AND   md.name_id = 1535
    AND   ms.id = md.value_id
    """
    job = column_property(
        select([func.max(Metastrings.string)]).\
        where(
            (Metadata.entity_guid == guid) &
            (Metadata.name_id == 1535) &
            (Metastrings.id == Metadata.value_id)
        )
    )


class Groups(Base):
    """
    Mapping out groups

    Similar to the Users table, it is often
    easier to get some properties of a group
    in the SQL model rather than from
    GraphQL's schema
    """
    __tablename__ = 'elgggroups_entity'
    guid = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)


    """
    In many cases, just having the count of members can suffice for queries
    and even many development cases

    SQL Query:

    SELECT count(r.guid_two)
    FROM elggentity_relationships r
    WHERE r.guid_two = [GROUP GUID]
    AND r.relationship = 'member'

    Because the database interprets a user joining a group as them sending
    a member request to the group, the user is guid_one and the group is
    guid_two. There is no difference in counting guid_one or guid_two
    """
    members_count = column_property(
        select([func.count(Relationships.guid_two)]).\
        where(and_(Relationships.guid_two == guid,
                  Relationships.relationship == 'member'))
    )
    """
    Counting the number of discussions found within a group

    SQL Query:

    SELECT count(e.guid)
    FROM elggentities e
    WHERE e.container_guid = [GROUP GUID]
    AND   e.subtype = 7
    """
    discussions_count = column_property(
        select([func.count(Entities.guid)]).\
        where(and_(
            Entities.container_guid == guid,
            Entities.subtype == 7
        ))
    )
    """
    Counting the number of blogs found within a group

    SQL Query:

    SELECT count(e.guid)
    FROM elggentities e
    WHERE e.container_guid = [GROUP GUID]
    AND   e.subtype = 5
    """
    blogs_count = column_property(
        select([func.count(Entities.guid)]).\
        where(and_(
            Entities.container_guid == guid,
            Entities.subtype == 5
        ))
    )
    """
    Counting the number of files found within a group

    SQL Query:

    SELECT count(e.guid)
    FROM elggentities e
    WHERE e.container_guid = [GROUP GUID]
    AND   e.subtype = 1
    """
    files_count = column_property(
        select([func.count(Entities.guid)]).\
        where(and_(
            Entities.container_guid == guid,
            Entities.subtype == 1
        ))
    )

