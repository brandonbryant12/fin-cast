- Get workflow to deploy to digital ocean on push to main 

- get the appr unning with domain fincast.brandonbryant.io

- common http client with options for proxy 

- split llm and tts into their own 

- implement new llm and tts 

- publish as npm package llm and tts packages - on each commit to main (improve readme's)

- for the tts and llm, have a ttsProvider and llmProvider that control what service to create. the env variables will provide this and throw error if whole config not created.

## Infra 

- Set up a managed db remove the db service from remote compose

- set up protected branches 


# BUG - 
 - trying to fetch voices even on login page (401 error)

 - migrate in workflow

## UI 

- make UI reactive, adjust the style guide


## new feature

- Do not provide audio url on podcast when fetch all.  On play get the audio url from the podcast id 

- create podcast from multiple urls 

- slider to select desired length max length (we will need estimate how many tokens = 1 second)

- improve the news feed, my news features 

- generate avatars for the personalities

- progress bar creating podcast rather than spinner
