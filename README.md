# LLM Coup

This project is a simulation environment for evaluating the capabilities of Large Language Models (LLMs) in the context of deception and multi-level strategy games. The game of Coup is used as the testing ground for these evaluations.

## Motivation

The primary motivation for this experiment is to create a controlled environment to study how LLMs perform in scenarios that require:

*   **Deception:** The ability to bluff and mislead other players.
*   **Strategic Thinking:** The ability to make multi-level decisions based on incomplete information and to anticipate the actions of other players.
*   **Adaptation:** The ability to adjust strategies based on the actions of other players and the changing game state.

## Features

*   **Multi-LLM Support:** The simulation supports multiple LLM providers, including Gemini, Anthropic, and OpenAI.
*   **Self-Play:** The simulation can be run with a single LLM playing against itself, allowing for the study of emergent strategies and behaviors.
*   **Personality Manipulation:** Players can be assigned different personalities via prompts, allowing for the study of how different behavioral archetypes affect game dynamics.

### Why Coup?

Well, being able to measure the tendency that LLMs have for deception and longer-horizon strategy games is useful, especially as they're released into the wild in environments that reward those behaviors. This game gives us a toy environment where we can measure LLM capabilities for deception & strategy, measuring on baseline how well and individual model is able to compete, and then how models play against one another.

Pros of Coup:
- Rewards deception
- Requires some multi-stage thinking

Cons of Coup:
- Large element of chance based on initial conditions / "luck of the draw"
- Doesn't reward deception _enough_; it's somewhat easy to get far in the game just playing honestly

## Game Rules

Coup is a social deduction game where the goal is to be the last player with influence remaining. Influence is represented by face-down character cards, and each player starts with two.

Each turn, a player can take one of several actions. Some actions are associated with specific characters, and any player can claim to be that character to perform the action. If a player's claim is challenged, they must reveal the corresponding character card. If they can't, they lose an influence. If they can, the challenger loses an influence.

For a full guide on the game rules, checkout the [Coup Wikihow Page](https://www.wikihow.com/Play-Coup).

## Run it Yourself

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

### Running the Game

To start a game, run the following command:

```bash
yarn play
```

This will start a new game with 4 players using the default model. You can customize the game by using the following options:

*   `-p, --players <number>`: Number of players (2-6). Defaults to 4.
*   `--player-model <provider:model_name>`: Specify a player model. This option can be used multiple times to have players with different models. For example: `--player-model GEMINI:gemini-pro --player-model ANTHROPIC:claude-3-sonnet-20240229`. If fewer models are provided than the number of players, models will be assigned to players in a round-robin fashion.
*   `--personalities`: Use different personalities for players. When this is enabled, only one `--player-model` can be specified.
*   `--discussion`: Enable player discussions.

#### Examples

Run a game with 3 players, two using Gemini and one using Anthropic:
```bash
yarn play --players 3 --player-model GEMINI:gemini-pro --player-model GEMINI:gemini-pro --player-model ANTHROPIC:claude-3-sonnet-20240229
```

Run a game with 5 players, all using Gemini Pro with different personalities:
```bash
yarn play --players 5 --player-model GEMINI:gemini-pro --personalities
```

### API Keys

You must set the environment variable for your LLM provider's API key.

*   For Gemini: `export GEMINI_API_KEY="your-api-key"`
*   For Anthropic: `export ANTHROPIC_API_KEY="your-api-key"`
*   For OpenAI: `export OPENAI_API_KEY="your-api-key"`

You can set this in your terminal or by adding it to a `.env` file in the root of the project.
