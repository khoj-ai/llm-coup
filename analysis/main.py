import pandas as pd
import plotly.express as px
import logging
import os
import numpy as np

# --- Configuration ---
EXCLUDED_MODELS = [
    'claude-3-5-haiku-latest',
    'gpt-4.1-2025-04-14',
    'gpt-4.1-mini-2025-04-14'
]

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_metric_descriptions():
    """Returns a dictionary of descriptions for hover tooltips."""
    return {
        'win_rate': 'The number of wins for a model divided by the total number of games it participated in within this category (self-play or mixed-model).',
        'average_elimination_round': 'The average round in which a model\'s players are eliminated. For winners, the elimination round is considered the final round of the game plus one.',
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
    # Temporarily filter out excluded models
    if EXCLUDED_MODELS:
        original_count = len(df)
        df = df[~df['model'].isin(EXCLUDED_MODELS)]
        logging.info(f"Filtered out {original_count - len(df)} records for excluded models.")

    logging.info(f"--- Starting {analysis_type} Analysis --- ")
    if df.empty:
        logging.warning(f"No {analysis_type} games found to analyze. Skipping.")
        return []

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    plot_files = []
    descriptions = get_metric_descriptions()

    # 1. Win Rate
    logging.info("Calculating Win Rate...")
    games_per_model = df.groupby(['model', 'public_discussion'])['game_id'].nunique().reset_index(name='games_played')
    wins_per_model = df[df['winner']].groupby(['model', 'public_discussion']).size().reset_index(name='wins')
    win_rate_stats = pd.merge(games_per_model, wins_per_model, on=['model', 'public_discussion'], how='left').fillna(0)
    win_rate_stats['win_rate'] = win_rate_stats['wins'] / win_rate_stats['games_played']
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    win_rate_stats['public_discussion'] = win_rate_stats['public_discussion'].map(discussion_map)
    fig = px.bar(win_rate_stats, x='model', y='win_rate', color='public_discussion', barmode='group',
                 title=f"Win Rate by Model ({analysis_type})",
                 text=win_rate_stats.apply(lambda row: f"{int(row.wins)} wins / {row.games_played} games", axis=1),
                 hover_name='model', hover_data={'model': False, 'win_rate': ':.2f', 'public_discussion': True})
    fig.update_traces(hovertemplate='<b>%{hovertext}</b><br>Win Rate: %{y}<br>' + descriptions['win_rate'])
    plot_path = os.path.join(output_dir, "win_rate_by_model.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 2. Average Elimination Round
    logging.info("Calculating Average Elimination Round...")
    # Include winners by using the game duration as their "elimination round"
    df_with_winner_rounds = df.copy()
    df_with_winner_rounds['effective_elimination_round'] = np.where(
        df_with_winner_rounds['winner'],
        df_with_winner_rounds.groupby('game_id')['elimination_round'].transform('max') + 1,
        df_with_winner_rounds['elimination_round'] + 1
    )
    elimination_stats = df_with_winner_rounds.groupby(['model', 'public_discussion'])['effective_elimination_round'].mean().reset_index(name='average_elimination_round')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    elimination_stats['public_discussion'] = elimination_stats['public_discussion'].map(discussion_map)
    fig = px.bar(elimination_stats, x='model', y='average_elimination_round', color='public_discussion', barmode='group',
                 title=f"Average Elimination Round ({analysis_type})",
                 hover_name='model', hover_data={'model': False, 'average_elimination_round': ':.2f', 'public_discussion': True})
    fig.update_traces(hovertemplate='<b>%{hovertext}</b><br>Average Elimination Round: %{y}<br>' + descriptions['average_elimination_round'])
    plot_path = os.path.join(output_dir, "average_elimination_round_by_model.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)


    # 2.5. Cause of Elimination
    logging.info("Calculating Cause of Elimination...")
    elimination_causes = df[df['cause_of_elimination'].notna()].copy()
    elimination_causes['cause_of_elimination'] = elimination_causes['cause_of_elimination'].str.split(';')
    elimination_causes = elimination_causes.explode('cause_of_elimination')
    elimination_causes_stats = elimination_causes.groupby(['model', 'public_discussion', 'cause_of_elimination']).size().reset_index(name='count')

    # Normalize by the number of eliminations per model
    total_eliminations = elimination_causes_stats.groupby(['model', 'public_discussion'])['count'].transform('sum')
    elimination_causes_stats['percentage'] = (elimination_causes_stats['count'] / total_eliminations) * 100

    discussion_map = {True: 'with discussion', False: 'without discussion'}
    elimination_causes_stats['public_discussion'] = elimination_causes_stats['public_discussion'].map(discussion_map)
    elimination_causes_stats['cause_discussion'] = elimination_causes_stats['cause_of_elimination'] + " (" + elimination_causes_stats['public_discussion'] + ")"
    fig = px.bar(elimination_causes_stats, x='model', y='percentage', color='cause_discussion', barmode='group',
                 title=f"Normalized Causes of Elimination by Model ({analysis_type})",
                 labels={'percentage': 'Percentage of Eliminations (%)'},
                 hover_data={'count': True}) # Show raw count on hover
    fig.update_yaxes(ticksuffix='%')
    plot_path = os.path.join(output_dir, "elimination_causes_by_model.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 3. Deception Effectiveness
    logging.info("Calculating Deception Effectiveness...")
    df['game_duration'] = df.groupby('game_id')['elimination_round'].transform('max')
    df['rounds_survived'] = np.where(df['winner'], df['game_duration'], df['elimination_round'])
    df['bluffs_per_round'] = np.divide(df['num_bluffs'], df['rounds_survived'])
    df['bluffs_per_round'] = df['bluffs_per_round'].replace([np.inf, -np.inf], 0)
    df['bluffing_success_rate'] = df['successful_bluffs'] / (df['successful_bluffs'] + df['failed_bluffs'])
    bluffing_analysis = df.groupby(['model', 'public_discussion']).agg(
        bluffing_success_rate=('bluffing_success_rate', 'mean'),
        bluffing_frequency=('num_bluffs', 'mean'),
        bluffs_per_round=('bluffs_per_round', 'mean')
    ).reset_index()
    
    bluffing_analysis_melted = bluffing_analysis.melt(id_vars=['model', 'public_discussion'],
                                                      value_vars=['bluffing_success_rate', 'bluffing_frequency', 'bluffs_per_round'],
                                                      var_name='metric', value_name='value')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    bluffing_analysis_melted['public_discussion'] = bluffing_analysis_melted['public_discussion'].map(discussion_map)
    bluffing_analysis_melted['metric_discussion'] = bluffing_analysis_melted['metric'] + " (" + bluffing_analysis_melted['public_discussion'] + ")"

    fig = px.bar(bluffing_analysis_melted, x='model', y='value', color='metric_discussion', barmode='group',
                 title=f"Deception Behavior ({analysis_type})")
    plot_path = os.path.join(output_dir, "deception_behavior.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 3. Economic Analysis
    logging.info("Calculating Economic Analysis...")
    eco_stats = df.groupby(['model', 'public_discussion']).agg(
        avg_coins_earned=('total_coins_earned', 'mean'),
        total_earned=('total_coins_earned', 'sum'),
        total_lost_to_theft=('coins_lost_to_theft', 'sum')
    ).reset_index()
    eco_stats['efficiency_ratio'] = np.divide(eco_stats['total_earned'], eco_stats['total_lost_to_theft'])
    eco_stats['efficiency_ratio'] = eco_stats['efficiency_ratio'].replace([np.inf, -np.inf], np.nan)
    
    eco_stats_melted = eco_stats.melt(id_vars=['model', 'public_discussion'],
                                          value_vars=['avg_coins_earned', 'efficiency_ratio'],
                                          var_name='metric', value_name='value')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    eco_stats_melted['public_discussion'] = eco_stats_melted['public_discussion'].map(discussion_map)
    eco_stats_melted['metric_discussion'] = eco_stats_melted['metric'] + " (" + eco_stats_melted['public_discussion'] + ")"

    fig = px.bar(eco_stats_melted, x='model', y='value', color='metric_discussion', barmode='group',
                 title=f"Economic Performance ({analysis_type})")
    plot_path = os.path.join(output_dir, "economic_performance.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 4. Challenge Analysis
    logging.info("Calculating Challenge Rates...")
    challenge_stats = df.groupby(['model', 'public_discussion']).agg(
        challenges_won=('challenges_won', 'sum'),
        challenges_lost=('challenges_lost', 'sum')
    ).reset_index()
    challenge_stats['total_challenges'] = challenge_stats['challenges_won'] + challenge_stats['challenges_lost']
    challenge_stats['challenge_win_rate'] = np.divide(challenge_stats['challenges_won'], challenge_stats['total_challenges'])
    challenge_stats['challenge_win_rate'] = challenge_stats['challenge_win_rate'].replace([np.inf, -np.inf], np.nan)
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    challenge_stats['public_discussion'] = challenge_stats['public_discussion'].map(discussion_map)
    fig = px.bar(challenge_stats, x='model', y=['challenge_win_rate'], color='public_discussion', barmode='group',
                 title=f"Challenge Win Rate ({analysis_type})")
    fig.update_traces(hovertemplate='<b>%{x}</b><br>Challenge Win Rate: %{y:.2f}<br>' + descriptions['challenge_win_rate'])
    plot_path = os.path.join(output_dir, "challenge_behavior.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 5. Aggression Analysis
    logging.info("Calculating Aggression Metrics...")
    aggression_stats = df.groupby(['model', 'public_discussion']).agg(
        attacks_launched=('attacks_launched', 'sum'),
        attacks_received=('attacks_received', 'sum'),
        coups_launched=('coups_launched', 'sum')
    ).reset_index()
    aggression_stats['aggression_ratio'] = np.divide(aggression_stats['attacks_launched'], aggression_stats['attacks_received'])
    aggression_stats['aggression_ratio'] = aggression_stats['aggression_ratio'].replace([np.inf, -np.inf], np.nan)
    
    aggression_stats_melted = aggression_stats.melt(id_vars=['model', 'public_discussion'],
                                                      value_vars=['attacks_launched', 'attacks_received', 'coups_launched', 'aggression_ratio'],
                                                      var_name='metric', value_name='value')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    aggression_stats_melted['public_discussion'] = aggression_stats_melted['public_discussion'].map(discussion_map)
    aggression_stats_melted['metric_discussion'] = aggression_stats_melted['metric'] + " (" + aggression_stats_melted['public_discussion'] + ")"

    fig = px.bar(aggression_stats_melted, x='model', y='value', color='metric_discussion', barmode='group',
                 title=f"Aggression Metrics ({analysis_type})")
    plot_path = os.path.join(output_dir, "aggression_metrics.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    # 6. Game Dynamics
    logging.info("Analyzing Game Dynamics...")
    game_dynamics = df.groupby(['model', 'public_discussion']).agg(
        avg_play_time=('total_play_time', 'mean')
    ).reset_index()
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    game_dynamics['public_discussion'] = game_dynamics['public_discussion'].map(discussion_map)
    fig = px.bar(game_dynamics, x='model', y='avg_play_time', color='public_discussion', barmode='group',
                 title=f"Average Play Time per Game ({analysis_type})")
    fig.update_traces(hovertemplate='<b>%{x}</b><br>Average Play Time: %{y:.2f}s<br>' + descriptions['avg_play_time'])
    plot_path = os.path.join(output_dir, "game_dynamics.html")
    fig.write_html(plot_path)
    plot_files.append(plot_path)

    logging.info(f"--- Finished {analysis_type} Analysis ---")
    return plot_files

def create_report(plot_files, title, output_filename="analysis_report.html"):
    """Combines multiple plotly HTML files into a single report."""
    logging.info(f"Creating report: {output_filename}")
    
    # Start the HTML report
    html_content = f'''
    <html>
        <head>
            <title>{title}</title>
            <style>
                body {{ font-family: sans-serif; margin: 2em; }}
                h1 {{ text-align: center; }}
                .plot-container {{ border: 1px solid #ddd; margin-bottom: 2em; padding: 1em; box-shadow: 2px 2px 10px #ccc; }}
            </style>
        </head>
        <body>
            <h1>{title}</h1>
    '''

    # Append each plot
    for plot_file in plot_files:
        try:
            with open(plot_file, 'r', encoding='utf-8') as f:
                plot_html = f.read()
                # Extract the body content of the plot
                plot_body = plot_html[plot_html.find('<body>') + 6:plot_html.find('</body>')]
                html_content += f'<div class="plot-container">{plot_body}</div>'
        except FileNotFoundError:
            logging.warning(f"Plot file not found: {plot_file}")

    # End the HTML report
    html_content += '''
        </body>
    </html>
    '''

    # Write the final report
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(html_content)
    logging.info(f"Report saved to {output_filename}")


def main():
    df = pd.read_csv("../results.csv")
    logging.info(f"Loaded {len(df)} records.")

    # Identify self-play games
    game_model_counts = df.groupby('game_id')['model'].nunique()
    self_play_game_ids = game_model_counts[game_model_counts == 1].index
    
    # Create dataframes for each analysis type
    df_self_play = df[df['game_id'].isin(self_play_game_ids)]
    df_mixed_model = df[~df['game_id'].isin(self_play_game_ids)]

    # Filter mixed-model games to only include those with at least 3 players
    players_per_game = df_mixed_model.groupby('game_id').size()
    games_with_enough_players = players_per_game[players_per_game >= 3].index
    original_mixed_games = len(df_mixed_model['game_id'].unique())
    df_mixed_model = df_mixed_model[df_mixed_model['game_id'].isin(games_with_enough_players)]
    filtered_mixed_games = len(df_mixed_model['game_id'].unique())
    logging.info(f"Filtered mixed-model games: {original_mixed_games} -> {filtered_mixed_games} (kept games with >= 3 players)")

    # Run analyses and collect plot file paths
    self_play_plots = run_analysis(df_self_play, "plots/self_play", "Self-Play")
    mixed_model_plots = run_analysis(df_mixed_model, "plots/mixed_model", "Mixed-Model")

    # Create combined reports
    if self_play_plots:
        create_report(self_play_plots, "Self-Play Analysis Report", "self_play_report.html")
    if mixed_model_plots:
        create_report(mixed_model_plots, "Mixed-Model Analysis Report", "mixed_model_report.html")
    
    all_plots = self_play_plots + mixed_model_plots
    if all_plots:
        create_report(all_plots, "Full Analysis Report", "full_analysis_report.html")


if __name__ == "__main__":
    main()