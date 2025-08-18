# Data

This directory contains the data from the experiments. [See full a full analysis of the results of this experiment](https://coup.khoj.dev).

## Files

*   `results.csv`: Contains high-level metrics for each player for each game. This includes win/loss information, elimination order, and other summary statistics.
*   `discussion_analysis.csv`: A qualitative analysis of the public discussion traces from the games. The selected data is based on basic heuristics.
*   `qualitative_analysis.csv`: A qualitative analysis of the models' implicit reasoning traces. The selected data is based on basic heuristics.

## Logs

*   `logs/`: This directory contains the full, raw game logs for each experimental run. Each file corresponds to a single game.

## Analysis

The scripts used to process this data and generate the findings in the report can be found in the [`/analysis`](../analysis) folder.
