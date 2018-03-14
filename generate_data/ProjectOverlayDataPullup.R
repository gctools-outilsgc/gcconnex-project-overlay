
library(tidyverse)
library(dbplyr)
library(jsonlite)


setwd("/Users/Owner/Documents/Work_transfer/Project_Overlay/")

con <- DBI::dbConnect(RMySQL::MySQL(), 
                      host = "192.168.1.99",
                      user = "elgg",
                      dbname = "elgg12",
                      password = rstudioapi::askForPassword("Database password")
)


load_data <- function(path) {
  
  tryCatch(
    df <- read_csv(path),
    error = function() {
      
      entities_table <- tbl(con, 'elggentities')
      metadata_table <- tbl(con, 'elggmetadata')
      metastrings_table <- tbl(con, 'elggmetastrings')
      groups_table <- tbl(con, 'elgggroups_entity')
      
      
      content <- entities_table %>%
        select(
          guid,
          subtype,
          time_created,
          container_guid
        ) %>%
        filter(
          subtype %in% c(1,5,7,8)
        ) %>% collect()
      
      content_tags <- tbl(con,
                          sql(
                            "
                            SELECT md.entity_guid, ms.string
                            FROM elggmetadata md
                            JOIN elggmetastrings ms ON ms.id = md.value_id
                            JOIN elggentities e ON e.guid = md.entity_guid
                            WHERE e.subtype IN (1,5,7,8) AND md.name_id = 119
                            "
                          )) %>% collect()
      
      
      content_audience <- tbl(con,
                              sql(
                                "
                                SELECT md.entity_guid, ms.string
                                FROM elggmetadata md
                                JOIN elggmetastrings ms ON ms.id = md.value_id
                                JOIN elggentities e ON e.guid = md.entity_guid
                                WHERE e.subtype IN (1,5,7,8) AND md.name_id = 35557
                                "
                              )) %>% collect()
      
      group_tags <- tbl(con,
                        sql(
                          "
                          SELECT md.entity_guid, ms.string
                          FROM elggmetadata md
                          JOIN elggmetastrings ms ON ms.id = md.value_id
                          JOIN elggentities e ON e.guid = md.entity_guid
                          WHERE e.type = 'group' AND md.name_id =  59
                          "
                        )) %>% collect()
      
      names(content) <- c("content_guid", "subtype", "time_created", "container_guid")
      names(group_tags) <- c("group_guid", "group_tag")
      names(content_tags) <- c("content_guid", "content_tag")
      names(content_audience) <- c("content_guid", "content_audience")
      
      groups <- tbl(con, 'elgggroups_entity') %>% collect()
      
      
      df <- inner_join(groups, content, by=c("guid" = "container_guid")) #%>%
      
      
      
      df <- df %>% 
        full_join(group_tags, by=c("guid" = "group_guid")) %>%
        full_join(content_tags) %>%
        full_join(content_audience) %>%
        write_csv("group_content_tags.csv")
      
      return(df)
      
      
    }
                        )
  
  return(df)
  
}


prepare_for_json <- function(dataframe, variable,  ...) {
  
  # Creates a specific type of dataframe primed
  #for the JSON object for the use in a project
  # overlay. The code is relatively simple, but it helps to have it
  # in an automatic function.
  
  # dataframe = .....well a dataframe. Pipe friendly
  # variable = variable(s) as a string or character vector to be selected for JSON
  # args = variables to be selected as the keys in the JSON object. In NSE.
  main_variable <- quos(...)
  
  new_df <- dataframe %>%
    select(one_of(variable)) %>%
    unique() %>%
    group_by(!!! main_variable) %>%
    nest()
  return(new_df)
} 

make_json <- function(dataframe) {
  return(dataframe %>% toJSON() %>% prettify())
}

unnest_tibble <- function(dataframe, nested_tibble, column_name, drop_like_hot = TRUE) {
  
  dataframe[[column_name]] <- dataframe[[nested_tibble]] %>% map(function(x) x %>% map(unlist))
  
  if(drop_like_hot) dataframe[[nested_tibble]] <- NULL
  
  return(dataframe)
}

# Filtering by most content of that audience
# doesn't factor in

# Extracts tags from nested list
extract_nested_attribute <- function(df, path1, path2) {
  return(
    list(
      unlist(
        df[[path1]] %>% map(unnest) %>% map(pluck, path2)
      )
    )
  )
}

#groups_content_tags$tags <- groups_content_tags %>% extract_nested_attribute("all_content", "content_tag") %>% unique()
# Extracts audience from nested list
#groups_content_tags$audience <- groups_content_tags %>% extract_nested_attribute("all_content", "content_audience") %>% unique()

groups_content_tags %>% make_json() %>% write_json("json_.json")




content_table <- popular_issues %>%
  prepare_for_json(
    c("content_guid", "subtype", "time_created","content_audience", "content_tag"),
    content_guid, subtype, time_created
    ) %>% 
  unnest_tibble("data", "tags")
  
group_table <- popular_issues %>%
  select(-one_of(c("subtype", "time_created","content_audience", "content_tag"))) %>%
  prepare_for_json(
    c("guid", "name", "description", "group_tag", "content_guid"),
    guid, name, description, content_guid
  ) %>%
  unnest_tibble("data", "group_tags")

group_table %>% inner_join(content_table) %>%
  prepare_for_json(
    c("guid", "name", "description", "content_guid","group_tags", "subtype", "time_created", "tags"),
    guid, name, description
  ) %>%
  unnest_tibble("data", "newcol") %>% make_json()


group

df <- load_data("group_content_tags.csv")




content_per_community <- df %>%
  select(content_guid, content_audience) %>%
  drop_na() %>%
  group_by(content_audience) %>%
  unique() %>%
  summarise(
    count_per_comm = n()
  )




group_content_audience <- df %>%
  select(guid, content_guid, content_audience) %>%
  unique() %>%
  drop_na() %>%
  count(guid, content_audience, sort=T)


tags_and_audience <- df %>%
  drop_na() %>%
  select(content_audience, content_tag) %>%
  add_count(content_audience, content_tag, sort=T) %>%
  unique() %>%
  group_by(content_audience) %>%
  top_n(5) %>%
  arrange(content_audience, desc(n))

tags_and_audience_json <- tags_and_audience %>%
  group_by(content_audience) %>%
  nest() %>%
  toJSON() %>%
  prettify()

tags_and_audience$content_tag

popular_issues <- df %>% filter(content_tag %in% tags_and_audience$content_tag )
popular_issues
# Produces neat and tidy JSON
content_json <- popular_issues %>%
  select(content_guid, time_created, content_tag, content_audience, subtype) %>%
  unique() %>%
  group_by(content_guid, time_created) %>%
  nest()

group_stats_json <- popular_issues %>%
  select(guid, group_tag) %>%
  unique() %>%
  group_by(guid) %>%
  nest() %>%
  rename(group_tags = data)



groups_and_nested_content <-popular_issues %>%
  inner_join(content_json) %>%
  select(-c(content_guid, content_tag, content_audience, time_created, group_tag, subtype)) %>%
  unique() %>%
  rename(content = data) %>%
  group_by(guid,
           name,
           description) %>%
  nest() %>%
  rename(all_content = data)


groups_content_tags <- groups_and_nested_content %>%
  full_join(group_stats_json)
















