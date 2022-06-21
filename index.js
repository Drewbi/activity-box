const core = require('@actions/core')
const github = require('@actions/github')
// import { graphql } from "@octokit/graphql"

// const { Toolkit } = require('actions-toolkit')
// const { GistBox, MAX_LENGTH } = require('gist-box')
// const MAX_LINES = 20

const capitalize = str => str.slice(0, 1).toUpperCase() + str.slice(1)
const truncate = str =>
  str.length <= MAX_LENGTH ? str : str.slice(0, MAX_LENGTH - 3) + '...'


const serializers = {
  WatchEvent: item => {
    return `🌟 Starred repo: ${item.repo.name}`
  },
  IssueCommentEvent: item => {
    return `🗣 Commented on #${item.payload.issue.number} in ${item.repo.name}`
  },
  CreateEvent: item => {
    if(item.ref_type == 'repository')
      return `🆕 Created new repo: ${item.repo.name}`
    else
      return `⑂ Created branch ${item.payload.ref} in repo: ${item.repo.name}`
  },
  ForkEvent: item => {
    return `ᛘ Forked repo: ${item.repo.name}`
  },
  IssuesEvent: item => {
    return `❗️ ${capitalize(item.payload.action)} issue #${
      item.payload.issue.number
    } in ${item.repo.name}`
  },
  PullRequestEvent: item => {
    const emoji = item.payload.action === 'opened' ? '🆒' : '❌'
    const line = item.payload.pull_request.merged
      ? '🎉 Merged'
      : `${emoji} ${capitalize(item.payload.action)}`
    return `${line} PR #${item.payload.pull_request.number} in ${
      item.repo.name
    }`
  }
}

(async () => {
  const { GIST_ID, GH_USERNAME, GH_PAT } = process.env
  core.info(`Getting activity for ${GH_USERNAME}`)
  const accessToken = core.getInput('GITHUB_TOKEN')
  const octokit = github.getOctokit(accessToken)

  const { data: events } = await octokit.rest.activity.listEventsForAuthenticatedUser()
  core.info(events)
  const commits = events.data
      .filter(event => {
        const eventDate = new Date(event.created_at)
        // Return true if event is less than 1 week old
        return Date.now() - eventDate.getTime() < 7 * 24 * 60 * 60 * 1000
      })
      .filter(event => event.type === 'PushEvent')
    
    const commitCounter = (total, commit) => total + commit.payload.size
    const commitNum = commits.reduce(commitCounter, 0)

    var commitContent = `💻 No commits in the last week`
    if(commitNum > 0) {
      commitContent = commitNum > 1 
          ? `💻 Pushed ${ commitNum } commits in the last week` 
          : `💻 Pushed ${ commitNum } commit in the last week`
    }
    const extraContent = events.data
      // Filter out any boring activity
      .filter(event => serializers.hasOwnProperty(event.type))
      // We only have four lines to work with for other info
      .slice(0, MAX_LINES - 1)
      // Call the serializer to construct a string
      .map(item => serializers[item.type](item))
      // Truncate if necessary
      .map(truncate)
    
    const content = [commitContent, ...extraContent].join('\n')
    core.notice(content)
    // const box = new GistBox({ id: GIST_ID, token: GH_PAT })
    // try {
    //   tools.log.debug(`Updating Gist ${GIST_ID}`)
    //   await box.update({ content })
    //   tools.exit.success('Gist updated!')
    // } catch (err) {
    //   tools.log.debug('Error getting or update the Gist:')
    //   return tools.exit.failure(err)
    // }
})()

Toolkit.run(
  async tools => {
    const { GIST_ID, GH_USERNAME, GH_PAT } = process.env

    // Get the user's public events
    tools.log.debug(`Getting activity for ${GH_USERNAME}`)
    const events = await tools.github.activity.listPublicEventsForUser({
      username: GH_USERNAME,
      per_page: 100
    })
    tools.log.debug(
      `Activity for ${GH_USERNAME}, ${events.data.length} events found.`
    )
    
    const commits = events.data
      .filter(event => {
        const eventDate = new Date(event.created_at)
        // Return true if event is less than 1 week old
        return Date.now() - eventDate.getTime() < 7 * 24 * 60 * 60 * 1000
      })
      .filter(event => event.type === 'PushEvent')
    
    const commitCounter = (total, commit) => total + commit.payload.size
    const commitNum = commits.reduce(commitCounter, 0)
    

    var commitContent = `💻 No commits in the last week`
    if(commitNum > 0) {
      commitContent = commitNum > 1 
          ? `💻 Pushed ${ commitNum } commits in the last week` 
          : `💻 Pushed ${ commitNum } commit in the last week`
    }
        
    const extraContent = events.data
      // Filter out any boring activity
      .filter(event => serializers.hasOwnProperty(event.type))
      // We only have four lines to work with for other info
      .slice(0, MAX_LINES - 1)
      // Call the serializer to construct a string
      .map(item => serializers[item.type](item))
      // Truncate if necessary
      .map(truncate)
    
    const content = [commitContent, ...extraContent].join('\n')

    const box = new GistBox({ id: GIST_ID, token: GH_PAT })
    try {
      tools.log.debug(`Updating Gist ${GIST_ID}`)
      await box.update({ content })
      tools.exit.success('Gist updated!')
    } catch (err) {
      tools.log.debug('Error getting or update the Gist:')
      return tools.exit.failure(err)
    }
  },
  {
    event: 'schedule',
    secrets: ['GITHUB_TOKEN', 'GH_PAT', 'GH_USERNAME', 'GIST_ID']
  }
)
