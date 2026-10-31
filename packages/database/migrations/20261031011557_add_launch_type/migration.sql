UPDATE `installed_servers` SET `launch` = json_set(`launch`, '$.type', 'stdio')
WHERE json_extract(`launch`, '$.type') IS NULL;
