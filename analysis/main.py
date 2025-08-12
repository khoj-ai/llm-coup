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
        'economic_efficiency_ratio': 'The ratio of total coins earned to total coins lost to theft for a model. Higher is better. A value of NaN or inf means the model never had coins stolen.',
        'challenge_win_rate': 'The ratio of challenges won to total challenges made (won + lost).',
        'aggression_ratio': 'The ratio of attacks launched to attacks received. Higher indicates a more aggressive playstyle.',
        'avg_play_time': 'The average total play time in seconds for games involving this model.'
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

    # 2. Average Elimination Round
    logging.info("Calculating Average Elimination Round...")
    # Include winners by using the game duration as their "elimination round"
    df_with_winner_rounds = df.copy()
    df_with_winner_rounds['effective_elimination_round'] = np.where(
        df_with_winner_rounds['winner'], 
        df_with_winner_rounds.groupby('game_id')['elimination_round'].transform('max') + 1,
        df_with_winner_rounds['elimination_round'] + 1
    )
    elimination_stats = df_with_winner_rounds.groupby('model')['effective_elimination_round'].mean().reset_index(name='average_elimination_round')
    fig = px.bar(elimination_stats, x='model', y='average_elimination_round', title=f"Average Elimination Round ({analysis_type})",
                hover_name='model', hover_data={'model': False, 'average_elimination_round': ':.2f'})
    fig.update_traces(hovertemplate='<b>%{hovertext}</b><br>Average Elimination Round: %{y}<br>' + descriptions['average_elimination_round'])
    fig.write_html(os.path.join(output_dir, "average_elimination_round_by_model.html"))

    # 3. Deception Effectiveness
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

    # 4. Challenge Analysis
    logging.info("Calculating Challenge Rates...")
    challenge_stats = df.groupby('model').agg(
        challenges_won=('challenges_won', 'sum'),
        challenges_lost=('challenges_lost', 'sum')
    ).reset_index()
    challenge_stats['total_challenges'] = challenge_stats['challenges_won'] + challenge_stats['challenges_lost']
    challenge_stats['challenge_win_rate'] = np.divide(challenge_stats['challenges_won'], challenge_stats['total_challenges'])
    challenge_stats['challenge_win_rate'] = challenge_stats['challenge_win_rate'].replace([np.inf, -np.inf], np.nan)
    fig = px.bar(challenge_stats, x='model', y=['challenge_win_rate'], title=f"Challenge Win Rate ({analysis_type})", barmode='group')
    fig.update_traces(hovertemplate='<b>%{x}</b><br>Challenge Win Rate: %{y:.2f}<br>' + descriptions['challenge_win_rate'])
    fig.write_html(os.path.join(output_dir, "challenge_behavior.html"))

    # 5. Aggression Analysis
    logging.info("Calculating Aggression Metrics...")
    aggression_stats = df.groupby('model').agg(
        attacks_launched=('attacks_launched', 'sum'),
        attacks_received=('attacks_received', 'sum'),
        coups_launched=('coups_launched', 'sum')
    ).reset_index()
    aggression_stats['aggression_ratio'] = np.divide(aggression_stats['attacks_launched'], aggression_stats['attacks_received'])
    aggression_stats['aggression_ratio'] = aggression_stats['aggression_ratio'].replace([np.inf, -np.inf], np.nan)
    fig = px.bar(aggression_stats, x='model', y=['attacks_launched', 'attacks_received', 'coups_launched', 'aggression_ratio'], title=f"Aggression Metrics ({analysis_type})", barmode='group')
    fig.write_html(os.path.join(output_dir, "aggression_metrics.html"))

    # 6. Game Dynamics
    logging.info("Analyzing Game Dynamics...")
    game_dynamics = df.groupby('model').agg(
        avg_play_time=('total_play_time', 'mean')
    ).reset_index()
    fig = px.bar(game_dynamics, x='model', y='avg_play_time', title=f"Average Play Time per Game ({analysis_type})")
    fig.update_traces(hovertemplate='<b>%{x}</b><br>Average Play Time: %{y:.2f}s<br>' + descriptions['avg_play_time'])
    fig.write_html(os.path.join(output_dir, "game_dynamics.html"))

    logging.info(f"--- Finished {analysis_type} Analysis ---")

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
