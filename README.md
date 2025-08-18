# LLM Coup

![llm coup cover image](./docs/spiderman-llm-coup.png)

This project is a simulation environment for evaluating the capabilities of Large Language Models (LLMs) in the context of deception and multi-level strategy games. The game of [Coup](https://en.wikipedia.org/wiki/Coup_(card_game)) is used as the testing ground for these evaluations. To see the full breakdown, including background & results, check out the report:

👉🏾 [Blink Twice: Measuring Strategic Deception Amongst LLMs](https://coup.khoj.dev) 👈🏾

## Motivation

The primary motivation for this experiment is to create a controlled environment to study how LLMs perform in scenarios that require:

*   **Deception:** The ability to bluff and mislead other players.
*   **Strategic Thinking:** The ability to make multi-level decisions based on incomplete information and to anticipate the actions of other players.
*   **Adaptation:** The ability to adjust strategies based on the actions of other players and the changing game state.

Read more about the project's [motivation](https://coup.khoj.dev/#background--motivation).


### Why Coup?

Well, being able to measure the tendency that LLMs have for deception and longer-horizon strategy games is useful, especially as they're released into the wild in environments that reward those behaviors. This game gives us a toy environment where we can measure LLM capabilities for deception & strategy, measuring on baseline how well and individual model is able to compete, and then how models play against one another.

Pros of Coup:
- Rewards deception
- Requires some multi-stage thinking

Cons of Coup:
- Large element of chance based on initial conditions / "luck of the draw"
- Doesn't reward deception _enough_; it's somewhat easy to get far in the game just playing honestly

Read more about [why Coup was chosen](https://coup.khoj.dev/#background--motivation).

## Results

![example game play img](./docs/coup_game_state.png)

We see that large reasoning models are adept at handling multi-level strategy games and deceptions, but all LLMs tested performed well at Coup. [Check out the full report](https://coup.khoj.dev).

You can find outputted data, including logs and charts, [here](/data)

## Run it Yourself

Hell yeah, we love reproducible experiments! Replicate all of our findings with models of your choice by running the game engine yourself.

### Prerequisites

*   [Node.js](https://nodejs.org/en/) (v24 or higher)
*   [Yarn](https://yarnpkg.com/)

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/llm-coup.git
    cd llm-coup
    ```

2.  Install the dependencies:

    ```bash
    yarn install
    ```

3.  Set up your API keys:

    Create a `.env` file in the root of the repo and add your API keys for the LLM providers you want to use. For example:

    ```
    GEMINI_API_KEY="your-gemini-api-key"
    ANTHROPIC_API_KEY="your-anthropic-api-key"
    OPENAI_API_KEY="your-openai-api-key"
    GROK_API_KEY="your-grok-api-key"
    ```

### Running the Game

To start a game, run the following command:

```bash
yarn play
```

This will start a new game with 4 players using the default model. You can customize the game by using the following options:

*   `-p, --players <number>`: Number of players (2-6). Defaults to 4.
*   `--player-model <provider:model_name>`: Specify a player model. This option can be used multiple times to have players with different models. For example: `--player-model gemini:gemini-pro --player-model anthropic:claude-3-sonnet-20240229`. If fewer models are provided than the number of players, models will be assigned to players in a round-robin fashion.
*   `--discussion`: Enable player discussions.

#### Examples

Run a game with 3 players, two using Gemini and one using Anthropic:
```bash
yarn play --players 3 --player-model gemini:gemini-pro --player-model gemini:gemini-pro --player-model anthropic:claude-3-sonnet-20240229
```

Run a game with 5 players, all using Gemini Pro with different personalities:
```bash
yarn play --players 5 --player-model gemini:gemini-pro --personalities
```

### Features

*   **Multi-LLM Support:** The simulation supports multiple LLM providers, including Gemini, Anthropic, and OpenAI.
*   **Self-Play:** The simulation can be run with a single LLM playing against itself, allowing for the study of emergent strategies and behaviors.
*   **Personality Manipulation:** Players can be assigned different personalities via prompts, allowing for the study of how different behavioral archetypes affect game dynamics.
*   **Public Discussion:** Players can engage in public discussion to share information, negotiate, or deceive.
