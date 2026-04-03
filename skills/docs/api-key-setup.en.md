# API Key Setup

## Get an API Key

- [Get an API Key](https://data-api.investoday.net/login)

## Configuration

Two configuration methods are supported. The environment variable takes precedence.

Configure the API Key through an environment variable. Avoid leaving the plaintext key in shell history:

```bash
export INVESTODAY_API_KEY=<your_key>
```

You can also create a `.env` file in the skill root for local use only. Do not commit it:

```dotenv
INVESTODAY_API_KEY=<your_key>
```

## Usage Rules

- Call the script directly; there is no need to pre-check whether `INVESTODAY_API_KEY` is configured before each invocation
- If the API Key is missing or invalid, the script will return an error message

## Security Rules

1. **Never print the plaintext API Key in terminal output, logs, or chat messages.**
2. When the user provides an API Key:
   - prefer asking the user to set the environment variable by themselves; if explicitly requested, the key may be saved in the skill root `.env`
   - do **not** echo, print, or reveal the key
   - after configuration, **must** respond with the following message:

> ✅ API Key has been configured. Your API Key is the unique credential for accessing InvestToday data. Store it securely and never expose it in chats, screenshots, or code commits.

3. When calling the API, **do not** place the API Key in command-line arguments, logs, or error output.
4. When checking whether the key is configured, only say `configured` or `not configured`. Do **not** reveal any part of the key.
