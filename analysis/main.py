import pandas as pd
import plotly.express as px
import logging
import os
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_metric_descriptions():
    """Returns a dictionary of descriptions for hover tooltips."""
    return {
        'win_rate': 'The number of wins for a model divided by the total number of games it participated in within this category (self-play or mixed-model).',
        'average_elimination_round': 'The average round in which a model\'s players are eliminated. This only includes players who lost the game.',
        'bluffing_success_rate': 'The average ratio of successful bluffs to total bluffs (successful + failed).',
        'bluffing_frequency': 'The average number of bluffs a model makes per game it plays (a simple average across all player instances).',
        'bluffs_per_round': 'The average number of bluffs a model makes per round survived, providing a more normalized measure of bluffing tendency.',
        'average_coins_earned': 'The average number of coins earned by a model\'s players by the end of each game.',
        'economic_efficiency_ratio': 'The ratio of total coins earned to total coins lost to theft for a model. Higher is better. A value of NaN or inf means the model never had coins stolen.'
    }

def run_analysis(df, output_dir, analysis_type):
    """Runs the full analysis suite on a given dataframe and saves the plots."""
    logging.info(f"--- Starting {analysis_type} Analysis --- ")
    if df.empty:
        logging.warning(f"No {analysis_type} games found to analyze. Skipping.")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    descriptions = get_metric_descriptions()

    # 1. Win Rate
    logging.info("Calculating Win Rate...")
    games_per_model = df.groupby('model')['game_id'].nunique().reset_index(name='games_played')
    wins_per_model = df[df['winner']].groupby('model').size().reset_index(name='wins')
    win_rate_stats = pd.merge(games_per_model, wins_per_model, on='model', how='left').fillna(0)
    win_rate_stats['win_rate'] = win_rate_stats['wins'] / win_rate_stats['games_played']
    fig = px.bar(win_rate_stats, x='model', y='win_rate', title=f"Win Rate by Model ({analysis_type})",
                 text=win_rate_stats.apply(lambda row: f"{int(row.wins)} wins / {row.games_played} games", axis=1),
                 hover_name='model', hover_data={'model': False, 'win_rate': ':.2f'})
    fig.update_traces(hovertemplate='<b>%{hovertext}</b><br>Win Rate: %{y}<br>' + descriptions['win_rate'])
    fig.write_html(os.path.join(output_dir, "win_rate_by_model.html"))

    # 2. Deception Effectiveness
    logging.info("Calculating Deception Effectiveness...")
    df['game_duration'] = df.groupby('game_id')['elimination_round'].transform('max')
    df['rounds_survived'] = np.where(df['winner'], df['game_duration'], df['elimination_round'])
    df['bluffs_per_round'] = np.divide(df['num_bluffs'], df['rounds_survived'])
    df['bluffs_per_round'] = df['bluffs_per_round'].replace([np.inf, -np.inf], 0)
    df['bluffing_success_rate'] = df['successful_bluffs'] / (df['successful_bluffs'] + df['failed_bluffs'])
    bluffing_analysis = df.groupby('model').agg(
        bluffing_success_rate=('bluffing_success_rate', 'mean'),
        bluffing_frequency=('num_bluffs', 'mean'),
        bluffs_per_round=('bluffs_per_round', 'mean')
    ).reset_index()
    fig = px.bar(bluffing_analysis, x='model', y=['bluffing_success_rate', 'bluffing_frequency', 'bluffs_per_round'], title=f"Deception Behavior ({analysis_type})", barmode='group')
    fig.write_html(os.path.join(output_dir, "deception_behavior.html"))

    # 3. Economic Analysis
    logging.info("Calculating Economic Analysis...")
    eco_stats = df.groupby('model').agg(
        avg_coins_earned=('total_coins_earned', 'mean'),
        total_earned=('total_coins_earned', 'sum'),
        total_lost_to_theft=('coins_lost_to_theft', 'sum')
    ).reset_index()
    eco_stats['efficiency_ratio'] = np.divide(eco_stats['total_earned'], eco_stats['total_lost_to_theft'])
    eco_stats['efficiency_ratio'] = eco_stats['efficiency_ratio'].replace([np.inf, -np.inf], np.nan)
    fig = px.bar(eco_stats, x='model', y=['avg_coins_earned', 'efficiency_ratio'], title=f"Economic Performance ({analysis_type})", barmode='group')
    fig.write_html(os.path.join(output_dir, "economic_performance.html"))

    logging.info(f"--- Finished {analysis_type} Analysis --- ")

def main():
    df = pd.read_csv("../results.csv")
    logging.info(f"Loaded {len(df)} records.")

    # Identify self-play games
    game_model_counts = df.groupby('game_id')['model'].nunique()
    self_play_game_ids = game_model_counts[game_model_counts == 1].index
    
    # Create dataframes for each analysis type
    df_self_play = df[df['game_id'].isin(self_play_game_ids)]
    df_mixed_model = df[~df['game_id'].isin(self_play_game_ids)]

    # Run analyses
    run_analysis(df_self_play, "plots/self_play", "Self-Play")
    run_analysis(df_mixed_model, "plots/mixed_model", "Mixed-Model")

if __name__ == "__main__":
    main()