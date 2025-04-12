Do not provide audio url on podcast when fetch all.  On play get the audio url from the podcast id 

## UI 

- make UI reactive, adjust the style guide

## Backend 

- think about breaking out utility functions in podcast service to make more maintainable.  Maybe a audio service inside that package would help.  Overall refactor of the code organization

- Think if we are doing dependency injection following the rt-stack methodelogy.  Im concerned adding podcast, logger, ect... to the ctx is not the intended use

## new feature
- create podcast from multiple urls 

- slider to select desired length max length (we will need estimate how many tokens = 1 second)

- improve the news feed, my news features 

- generate avatars for the personalities

