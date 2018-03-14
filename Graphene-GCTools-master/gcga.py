""" This module wraps the Google Analytics Reporting API
    allowing for quick and easy access to analytics data
    on GCconnex, GCcollab, and GCpedia. This is very much
    a work in progress. The intended end goal is to use
    this alongside the GCconnex database module to drive a
    web-based user interface allowing for self-serve data requests.
"""

# IMPORTS

# For querying the analytics API
from apiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials

# For munging data retrieved from API
import pandas as pd
import code
import matplotlib
import matplotlib.pyplot as plt
import seaborn as sns
from numpy import sum


class gcga:
    """ Object for interacting with the Analytics API """
    
    # Initialize API constants
    _SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']
    _KEY_FILE_LOCATION = '/Users/Owner/Documents/Work_transfer/GraphQLPractice/Graphene_Attempt - Phase Two/Other_Data/client_secrets.json'
    
    # Keep platform IDs for easy naming
    _view_ID = {
      'gccollab':'127642570',
      'gcconnex':'55943097',
      'gcpedia':'39673253'
    }
    
    # ANALYTICS API HOUSEKEEPING FUNCTIONS
    
    def __init__(self):
        # Set the default platform
        self.curr_platform = 'gcconnex'
        # Initialize the API object
        self.analytics = self._initialize_API()
    
    def _initialize_API(self):
        """ Initialize the Analytics API object """
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
          gcga._KEY_FILE_LOCATION, gcga._SCOPES)
        
        # Build the service object.
        analytics = build('analyticsreporting', 'v4', credentials=credentials)
        return analytics

    # REPORT FUNCTIONS (internal use only)
    
    def _construct_orderby(self, order):
        """ Build the correct orderBy object depending on type of request.
            Valid orders are 'views' and 'date'. """
        if order == 'views':
            return [
                {
                    'fieldName': 'ga:pageviews',
                    'sortOrder': 'DESCENDING'
                }
            ]
        if order == 'date':
            return [
                {
                    'fieldName': 'ga:date',
                    'sortOrder': 'ASCENDING'
                }
            ]

    def _make_report(self, start_date, end_date, metric, dimension, filterClauses, order, double_dimension=False):
        """ Build the report request and send it off. Return report object.
            string, string, string, string, list of dicts """
        # Order can be by date or views
        orderBy = self._construct_orderby(order)
        dim = []
        if double_dimension == True:
            dim = [{'name': dimension}, {'name': 'ga:PageTitle'}]
        else:
            dim = [{'name': dimension}]
            
        return self.analytics.reports().batchGet(
            body={
                'reportRequests':[
                    {
                        'viewId': self._view_ID[self.curr_platform],
                        'dateRanges': [{'startDate': start_date, 'endDate': end_date}],
                        'metrics': [{'expression': metric}],
                        'dimensions': dim,
                        'dimensionFilterClauses': filterClauses,
                        'orderBys': orderBy
                    }
                ]
            }
        ).execute()
    
    def _construct_filter_clause(self, metric, dimension, filter_list):
        """ Build the filterClause object.
           Filter list will arrive in the following format:
           [expression1, expression2, ...]
           Expressions can be negated by prefixing with NOT
           Expressions can be combined by prefixing with OR """
        
        # Begin building the filters
        filter_clauses = []
        for curr_filter in filter_list:
            # At this point check if negation has been used
            not_flag = False
            if curr_filter[0:3] == 'NOT':
                not_flag = True
                curr_filter = curr_filter[3:]
            if curr_filter[0:2] == 'OR':
                curr_filter = curr_filter[2:]
                filter_clauses[len(filter_clauses)-1]['experessions'] += ('|'+curr_filter)
                continue
            nf = {}
            nf['filters'] = [
                {
                    'dimensionName': dimension,
                    'not'          : not_flag,
                    'expressions'  : [curr_filter]
                }
            ]
            filter_clauses.append(nf)
        filter_clauses[0]['operator'] = 'AND'
        #code.interact(local=locals())
        return filter_clauses
   
    def _parse_response_into_df(self, response, double_dimension=False):
        """ Convert a response object into a pandas dataframe """
        # Still needs a way to use multiple metrics
        # Stash the results in parallel lists
        dimension_list = []
        metric_list = []
        d2_list = []
        
        for report in response.get('reports', []):
            columnHeader = report.get('columnHeader', {})
            dimensionHeaders = columnHeader.get('dimensions', [])
            metricHeaders = columnHeader.get('metricHeader', {}).get('metricHeaderEntries', [])
                
            # This is where it starts going through the actual response
            for row in report.get('data', {}).get('rows', []):
                dimensions = row.get('dimensions', [])
                dateRangeValues = row.get('metrics', [])
                dimension_list.append(dimensions[0])
                #code.interact(local=locals())
                if double_dimension == True:
                    d2_list.append(dimensions[1])
                metric_list.append(dateRangeValues[0]['values'][0])
            
            # THIS BETRAYED US ALL!!
            """
            for header, dimension in zip(dimensionHeaders, dimensions):
                dimension_list.append(dimension)
                #dimension.append(get_query(dimension).replace('+',' '))
                # get_query and similar functions should only be called when appropriate
                # Maybe more appropriate to do after function completes?
            for i, values in enumerate(dateRangeValues):
                for metricHeader, value in zip(metricHeaders, values.get('values')):
                    metric_list.append(value)
                    #print(value)"""
        
        # Produce a dataframe from the results
        #code.interact(local=locals())
        if double_dimension == True:
            return pd.DataFrame({'dimension':dimension_list, 'dimension2':d2_list, 'metric':metric_list})
        else:
            return pd.DataFrame({'dimension':dimension_list, 'metric':metric_list})
            
        #return df[df['dimension'] != 'EMPTY']
   
    # USER FACING FUNCTIONS
    
    def set_platform(self, platform):
        """ Set the current platform to pull analytics from. """
        try:
            p = gcga._view_ID[platform]
            self.curr_platform = platform
        except:
            print("Platform not recognized. Valid arguments are 'gcconnex', 'gccollab', or 'gcpedia'.")
    
    def search_queries(self, start_date='30daysAgo', end_date='today', cutoff=None):
        """ Return a dataframe containing search queries in descending order.
            Dates should be provided in YYYY-MM-DD format. """
        def get_query(url):
            try:
                query = url[url.index('=')+1:url.index('&')]
                if len(query) == 0:
                    return 'EMPTY'
                return query
            except:
                return 'query malformed'
        metric = 'ga:pageviews'
        dimension = 'ga:pagePath'
        # Build the filter clauses
        # NOTsucces|error
        filter_clause = self._construct_filter_clause(metric, dimension,
            ['^/search', 'NOTsucces|error'])
        # Send out the request and store the response
        #code.interact(local=locals())
        response = self._make_report(start_date, end_date, metric, dimension, filter_clause, order='views')
        
        # Need function to process response into a dataframe
        df = self._parse_response_into_df(response)
        df.columns = ['query', 'searches']
        df['query'] = df['query'].apply(lambda x: get_query(x).replace('+',' '))
        return df[df['query'] != 'EMPTY']
        # parse_response_to_df(response)
    
    def content_views(self, regex_query, start_date='30daysAgo', end_date='today'):
        """Returns a dataframe containing views for each piece of content in a group"""

        def get_filetype(url):
            # Returns filetype inferred from url
            url2 = url[url.find('/')+1:]
            return url2[:url2.find('/')]

        metric = 'ga:pageviews'
        dimension = 'ga:pagePath'

        filter_clause = self._construct_filter_clause(metric, dimension, [regex_query])
        response_stats = self._make_report(start_date, end_date, metric, 'ga:PagePath', filter_clause, order='views', double_dimension=True)

        df = self._parse_response_into_df(response_stats, double_dimension=True)
        
        df['dimension'] = df['dimension'].apply(lambda x: get_filetype(x))

        #return df
        return {
            'urls': df['dimension'].values.tolist(),
            'pageviews': df['metric'].values.tolist(),
            'titles': df['dimension2'].values.tolist()
        }

    def pageviews(self, URLs, start_date='30daysAgo', end_date='today', intervals=False):
        """ Return a dataframe containing views on a particular page.
            First argument can be a URL string or list of URLs. """
        def strip_domain(url):
            return url.replace('https://gcconnex.gc.ca/','').replace('https://gccollab.ca/','').replace('www.gcpedia.gc.ca/','')
        metric = 'ga:pageviews'
        dimension = 'ga:date'
        # Strip the domain from the URL
        if type(URLs) == list:
            URLs = list(map(lambda x: strip_domain(x), URLs ))
        else:
            URLs = [strip_domain(URLs)]
        # Construct filter clauses for both requests
        filter_clause = self._construct_filter_clause(metric, 'ga:pagePath', URLs)
        # Should first construct report for found pagePaths. Print to ensure nothing is wonky.
        # Construct report for stats.
        response_names = self._make_report(start_date, end_date, metric, 'ga:pagePath', filter_clause, order='views')
        response_stats = self._make_report(start_date, end_date, metric, 'ga:date', filter_clause, order='date')
        
        df_names = self._parse_response_into_df(response_names)
        df = self._parse_response_into_df(response_stats)
        df.columns = ['date', 'pageviews']
        df['date'] = df['date'].apply(lambda x: pd.to_datetime(x, format='%Y%m%d'))
        
        df.set_index('date', inplace=True)
        
        
        idx = pd.date_range(start_date, end_date)
        #code.interact(local=locals())
        df = df.reindex(idx, fill_value=0)
        df = df[df.index.weekday < 5] # Should work now
        df['pageviews'] = df['pageviews'].astype(int)
        if intervals == True: # Create both monthly and daily
            df_month = df.groupby(pd.TimeGrouper(freq='M')).sum()
            #code.interact(local=locals())
            df_month.reset_index(inplace=True)
            df_month.rename(columns={'index':'date'}, inplace=True)
            df_month['pageviews'] = df_month['pageviews'].astype(str)
            df_month['date'] = df_month['date'].apply(lambda x: x.strftime('%Y%m%d'))
            
        df.reset_index(inplace=True)
        #code.interact(local=locals()) 
        df.rename(columns={'index':'date'}, inplace=True)
        df['pageviews'] = df['pageviews'].astype(str)
        df['date'] = df['date'].apply(lambda x: x.strftime('%Y%m%d'))

        # Build lists from columns for C3 timechart format
        if intervals == True:
            return {
                'daily': {
                    'dates': df['date'].values.tolist(),
                    'pageviews': df['pageviews'].values.tolist()
                },
                'monthly': {
                    'dates': df_month['date'].values.tolist(),
                    'pageviews': df_month['pageviews'].values.tolist()
                }
            }
        else:
            return {
                'dates': df['date'].values.tolist(),
                'pageviews': df['pageviews'].values.tolist()
            }

# For testing purposes
ga = gcga()
#a = '{"stepIndex":4,"reqType":{"category":1,"filter":"https://gcconnex.gc.ca/groups/profile/272967/enblueprint-2020-objectif-2020fr"},"metric":2,"time":{"startDate":"2017-01-16","endDate":"2018-01-16","allTime":false}}'
a = ga.content_views('16005726')
#a = ga.pageviews('https://gcconnex.gc.ca/newsfeed/')
#a = ga.pageviews(['https://gccollab.ca/newsfeed/', 'NOToffset'], intervals=True, start_date='2010-01-01', end_date='2017-01-01')




