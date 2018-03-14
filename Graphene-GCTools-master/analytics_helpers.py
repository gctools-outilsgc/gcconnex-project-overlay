import pandas as pd
import json
"""
Because the Graphql data format is likely to become the dominant data format
in the team, there are some helper functions to convert the json files into dataframes
in a proper and predictable manner
"""

def to_json(graphqldata):
    
    data = graphqldata.data
    return json.loads(json.dumps(data))


def find(key, dictionary):
    for k, v in dictionary.items():
        if k == key:
            yield v
        elif isinstance(v, dict):
            for result in find(key, v):
                yield result
        elif isinstance(v, list):
            for d in v:
                for result in find(key, d):
                    yield result

                    
def split_nested_dict(df, col, concat=False, drop=False):
    """
    Splits a column that is a nested dictionary into a dataframe
    Each key is their own col
    """
    
    # Obtain a list of keys
    keys = df[col].apply(lambda x: list(x.keys()))
    
    key_list = []
    
    # Loops through all the lists in the array
    for i in keys.values:
        # Enters each list in the array
        for j in i:
            if j not in key_list:
                key_list.append(j)
                
    # Construct DataFrame
    series_list = []
    
    for key in key_list:
        # Creates a series from every key in the dataframe
        series_list.append(pd.Series(df[col].apply(lambda x: x[key])))
    
    new_df = pd.DataFrame(series_list)
    
    if len(new_df) == len(key_list):
        # If this is true, then the df is sideways
        new_df = new_df.T
    
    # Renaming the dataframe with the keys
    new_df.columns = key_list
    
    if not concat:
        return new_df
    
    
    new_df = pd.concat([df, new_df], axis=1)
    
    if drop:
        new_df.drop(col, inplace=True, axis=1)
        
    return new_df

def len_of_nested_list(df, col):
    return df[col].apply(lambda x: len(x))



def extract_list(df, col, extract=None, concat=False):
    """
    Pulls out list from a dataframe
    
    Returns a dataframe with as many
    columns as the maximum length
    of a list
    
    Be careful!
    """
    # Makes a series of each element in a list
    new_df = df[col].apply(lambda x: pd.Series(x))
    
    # Lets you pull a specific element
    if extract is not None:
        def extract_key(x,key):
            try:
                return x[key]
            except:
                pass
        # Pulls out a specific key
        new_df = new_df.applymap(lambda x: extract_key(x, extract))
    
    
    if concat:
        new_df = pd.concat([df, new_df], axis=1)
    
    return new_df


def list_value_counts(df, col, key, concat=False):
    """
    Builds off of extract_list(),
    drilling down to a specific key,
    and 
    """
    if not concat:
        return extract_list(df, col, key).T.apply(lambda x: x.value_counts()).fillna(0).T
    
    new_df = extract_list(df, col, key).T.apply(lambda x: x.value_counts()).fillna(0).T
    return pd.concat([df, new_df],axis=1)
    
    