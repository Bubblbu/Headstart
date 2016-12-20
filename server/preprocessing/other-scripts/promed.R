get_papers <- function(query, params = NULL, limit = 100) {
	# raw = read.csv("~/Dev/IMED2016/promed/latest_100_promedmails.csv", sep=",", header = F)

	# text = raw[c('V1','V4')]
	# colnames(text) = c('id', 'content')

	# metadata = raw[c('V1', 'V1', 'V2', 'V5', 'V4', 'V5', 'V5', 'V3', 'V5', 'V5')]
	# colnames(metadata) = c("id","pmid","title","authors","paper_abstract","published_in","year","date","url","subject")

	library(lubridate)

	raw = read.csv("/var/www/html/headstart/server/static/data/latest_100_promedmails.csv.csv", sep=",", header = F, stringsAsFactors=FALSE)
	dedup = raw[!duplicated(raw[,1]),]

	text = dedup[c('V1','V4')]
	colnames(text) = c('id', 'content')

	metadata = dedup[c('V1', 'V1', 'V2', 'V5', 'V4', 'V5', 'V5', 'V3', 'V5', 'V5')]
	colnames(metadata) = c("id","pmid","title","authors","paper_abstract","published_in","year","date","url","subject")
	metadata$date = as.Date(metadata$date, "%Y-%m-%d")
	# metadata$year = year(metadata$date)
	metadata$year = as.character(metadata$date)
	days = as.numeric(as.Date("20161104", "%Y%m%d") - metadata$date)
	metadata$readers = max(days)-days

  return(list(metadata = metadata, text = text))
}