# Game Data Analysis

This directory contains scripts to analyze the data generated from running Coup games. The main project for running games is described in the `README.md` in the root directory.

When games are run, they produce a `results.csv` file and a `logs/` directory in the parent directory. This analysis project assesses that completed game data.

## Setup

To set up the Python environment, run the following command:

```bash
uv sync
```

## Usage

There are a few steps to the analysis pipeline.

### Data Preparation

Run the following script to package relevant game-log outputs into a `data/` directory.

```bash
python3 data_preparation.py
```

### Qualitative Analysis

For qualitative analysis of the game discussions, run the following scripts:

```bash
python3 categorize_discussions.py
python3 process_logs.py
```

### Aggregate Analysis

To run the final aggregate analysis, which combines all the charts into a final report and exports them to the `export/` folder, run:

```bash
python3 main.py
```
