# Graphene-GCTools

An initial dive into adapting GraphQL via [Graphene-SQLAlchemy](https://github.com/graphql-python/graphene-sqlalchemy) for broader use with the Elgg platform and, more specifically, with GCconnex.

The file is meant to serve as a prototype for a backend of the Self Serve Data App. As such, it has absolutely no support
for mutations--only querying complex structures

## Setup
By cloning the repository, you need only run app.py, and everything else will be taken care of for you, provided you have the credentials
necessary to access the data.

### Credentials
If you do not have the credentials, you must first ensure you are entitled to the credentials. Here's a checklist to keep organized:

1) Are you a developer on the GCTools team?

If you answered yes to any or all of those questions, congratulations! You are entitled to the credentials!
Come see me personally, and I will provide you with the credentials in a secure manner.

## How it Works

The module takes full advantage of the [Graphene-SQLAlchemy Library](https://github.com/graphql-python/graphene-sqlalchemy).
models.py uses pure SQLAlchemy to define the models from the elgg database. Where appropriate it also extends some functionality
in the models through the column_property function.

All of the Graphene work is in schema.py, which defines the relationships between Content, User and Group (the three main
item types in the elgg platform).

I could explain how the whole system works, but I find it is easier to just explore the GraphQL development IDE (which is
turned on by default in app.py)

