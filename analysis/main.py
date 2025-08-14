import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import logging

# --- Configuration ---
EXCLUDED_MODELS = [
    'claude-3-5-haiku-latest',
    'gpt-4.1-2025-04-14',
    'gpt-4.1-mini-2025-04-14'
]
OUTPUT_DIR = "charts"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_color_map(categories):
    """Creates a color map for a list of categories using distinct, vibrant colors."""
    # Define a set of distinct, vibrant colors
    distinct_colors = [
        '#17becf',  # Cyan
        '#aec7e8',  # Light Blue
        '#ffbb78',  # Light Orange
        '#98df8a',  # Light Green
        '#ff9896',  # Light Red
        '#c5b0d5',  # Light Purple
        '#c49c94',  # Light Brown
        '#f7b6d3',  # Light Pink
        '#c7c7c7',  # Light Gray
        '#dbdb8d',  # Light Olive
        '#9edae5',  # Light Cyan
        '#1f77b4',  # Blue
        '#ff7f0e',  # Orange
        '#2ca02c',  # Green
        '#d62728',  # Red
        '#9467bd',  # Purple
        '#8c564b',  # Brown
        '#e377c2',  # Pink
        '#7f7f7f',  # Gray
        '#bcbd22',  # Olive
    ]
    
    color_map = {}
    for i, category in enumerate(categories):
        color_map[category] = distinct_colors[i % len(distinct_colors)]
    return color_map

def save_plot(fig, plot_path):
    """Saves a matplotlib figure."""
    os.makedirs(os.path.dirname(plot_path), exist_ok=True)
    fig.savefig(plot_path, bbox_inches='tight')
    plt.close(fig)

def run_analysis(df, output_dir, analysis_type):
    """Runs the full analysis suite on a given dataframe and saves the plots."""
    if EXCLUDED_MODELS:
        original_count = len(df)
        df = df[~df['model'].isin(EXCLUDED_MODELS)]
        logging.info(f"Filtered out {original_count - len(df)} records for excluded models.")

    logging.info(f"--- Starting {analysis_type} Analysis ---")
    if df.empty:
        logging.warning(f"No {analysis_type} games found to analyze. Skipping.")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 1. Win Rate
    logging.info("Calculating Win Rate...")
    games_per_model = df.groupby(['model', 'public_discussion'])['game_id'].nunique().reset_index(name='games_played')
    wins_per_model = df[df['winner']].groupby(['model', 'public_discussion']).size().reset_index(name='wins')
    win_rate_stats = pd.merge(games_per_model, wins_per_model, on=['model', 'public_discussion'], how='left').fillna(0)
    win_rate_stats['win_rate'] = win_rate_stats['wins'] / win_rate_stats['games_played']
    
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    win_rate_stats['public_discussion'] = win_rate_stats['public_discussion'].map(discussion_map)

    fig, ax = plt.subplots(figsize=(12, 8))
    
    bar_width = 0.35
    models = win_rate_stats['model'].unique()
    x = np.arange(len(models))
    
    with_discussion = win_rate_stats[win_rate_stats['public_discussion'] == 'with discussion']
    without_discussion = win_rate_stats[win_rate_stats['public_discussion'] == 'without discussion']

    # Align data for plotting
    with_discussion = with_discussion.set_index('model').reindex(models).reset_index()
    without_discussion = without_discussion.set_index('model').reindex(models).reset_index()

    bars1 = ax.bar(x - bar_width/2, without_discussion['win_rate'], bar_width, label='Without Discussion')
    bars2 = ax.bar(x + bar_width/2, with_discussion['win_rate'], bar_width, label='With Discussion')

    # Add game counts on top of the bars
    for bar, games in zip(bars1, without_discussion['games_played']):
        if not np.isnan(games):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), f'n={int(games)}',
                    ha='center', va='bottom', fontsize=9)

    for bar, games in zip(bars2, with_discussion['games_played']):
        if not np.isnan(games):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), f'n={int(games)}',
                    ha='center', va='bottom', fontsize=9)

    ax.set_ylabel('Win Rate')
    ax.set_title('Win Rate by Model')
    ax.set_xticks(x)
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.legend()
    
    fig.tight_layout()
    
    plot_path = os.path.join(output_dir, "win_rate_by_model.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

    # 2. Average Elimination Round
    logging.info("Calculating Average Elimination Round...")
    df_with_winner_rounds = df.copy()
    df_with_winner_rounds['effective_elimination_round'] = np.where(
        df_with_winner_rounds['winner'],
        df_with_winner_rounds.groupby('game_id')['elimination_round'].transform('max') + 1,
        df_with_winner_rounds['elimination_round'] + 1
    )
    elimination_stats = df_with_winner_rounds.groupby(['model', 'public_discussion'])['effective_elimination_round'].mean().reset_index(name='average_elimination_round')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    elimination_stats['public_discussion'] = elimination_stats['public_discussion'].map(discussion_map)

    fig, ax = plt.subplots(figsize=(12, 8))
    
    bar_width = 0.35
    models = elimination_stats['model'].unique()
    x = np.arange(len(models))
    
    with_discussion = elimination_stats[elimination_stats['public_discussion'] == 'with discussion']
    without_discussion = elimination_stats[elimination_stats['public_discussion'] == 'without discussion']

    with_discussion = with_discussion.set_index('model').reindex(models).reset_index()
    without_discussion = without_discussion.set_index('model').reindex(models).reset_index()

    ax.bar(x - bar_width/2, without_discussion['average_elimination_round'], bar_width, label='Without Discussion')
    ax.bar(x + bar_width/2, with_discussion['average_elimination_round'], bar_width, label='With Discussion')

    ax.set_ylabel('Average Elimination Round')
    ax.set_title('Average Elimination Round by Model')
    ax.set_xticks(x)
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.legend()
    
    fig.tight_layout()
    
    plot_path = os.path.join(output_dir, "average_elimination_round_by_model.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

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

    # Create a separate plot for each discussion type
    for discussion_type, group in elimination_causes_stats.groupby('public_discussion'):
        pivot_df = group.pivot(index='model', columns='cause_of_elimination', values='percentage').fillna(0)
        
        fig, ax = plt.subplots(figsize=(15, 8))
        pivot_df.plot(kind='bar', stacked=True, ax=ax, width=0.8)
        
        ax.set_ylabel('Percentage of Eliminations (%)')
        ax.set_title(f'Normalized Causes of Elimination by Model ({discussion_type})')
        ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
        ax.legend(title='Cause of Elimination', bbox_to_anchor=(1.05, 1), loc='upper left')
        
        fig.tight_layout()
        
        plot_path = os.path.join(output_dir, f"elimination_causes_by_model_{discussion_type.replace(' ', '_')}.png")
        save_plot(fig, plot_path)
        logging.info(f"Saved plot to {plot_path}")

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

    pivot_df = bluffing_analysis_melted.pivot(index='model', columns='metric_discussion', values='value').fillna(0)
    
    fig, ax = plt.subplots(figsize=(15, 8))
    pivot_df.plot(kind='bar', ax=ax, width=0.8)
    
    ax.set_ylabel('Value')
    ax.set_title('Deception Behavior')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Metric')
    
    fig.tight_layout()
    
    plot_path = os.path.join(output_dir, "deception_behavior.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

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

    pivot_df = eco_stats_melted.pivot(index='model', columns='metric_discussion', values='value').fillna(0)
    
    fig, ax = plt.subplots(figsize=(15, 8))
    pivot_df.plot(kind='bar', ax=ax, width=0.8)
    
    ax.set_ylabel('Value')
    ax.set_title('Economic Performance')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Metric')
    
    fig.tight_layout()
    
    plot_path = os.path.join(output_dir, "economic_performance.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

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

    pivot_df = challenge_stats.pivot(index='model', columns='public_discussion', values='challenge_win_rate').fillna(0)

    fig, ax = plt.subplots(figsize=(12, 8))
    pivot_df.plot(kind='bar', ax=ax, width=0.8)

    ax.set_ylabel('Challenge Win Rate')
    ax.set_title('Challenge Win Rate')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Public Discussion')

    fig.tight_layout()

    plot_path = os.path.join(output_dir, "challenge_behavior.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

    # 5. Aggression Analysis
    logging.info("Calculating Aggression Metrics...")
    aggression_stats = df.groupby(['model', 'public_discussion']).agg(
        attacks_launched=('attacks_launched', 'sum'),
        attacks_received=('attacks_received', 'sum'),
        coups_launched=('coups_launched', 'sum'),
        total_rounds=('rounds_survived', 'sum')
    ).reset_index()

    # Normalize by the number of rounds
    aggression_stats['attacks_launched_per_round'] = np.divide(aggression_stats['attacks_launched'], aggression_stats['total_rounds'])
    aggression_stats['attacks_received_per_round'] = np.divide(aggression_stats['attacks_received'], aggression_stats['total_rounds'])
    aggression_stats['coups_launched_per_round'] = np.divide(aggression_stats['coups_launched'], aggression_stats['total_rounds'])
    
    aggression_stats_melted = aggression_stats.melt(id_vars=['model', 'public_discussion'],
                                                      value_vars=['attacks_launched_per_round', 'attacks_received_per_round', 'coups_launched_per_round'],
                                                      var_name='metric', value_name='value')
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    aggression_stats_melted['public_discussion'] = aggression_stats_melted['public_discussion'].map(discussion_map)
    aggression_stats_melted['metric_discussion'] = aggression_stats_melted['metric'] + " (" + aggression_stats_melted['public_discussion'] + ")"

    pivot_df = aggression_stats_melted.pivot(index='model', columns='metric_discussion', values='value').fillna(0)

    fig, ax = plt.subplots(figsize=(15, 8))
    pivot_df.plot(kind='bar', ax=ax, width=0.8)

    ax.set_ylabel('Value (Normalized per Round)')
    ax.set_title('Normalized Aggression Metrics')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Metric')

    fig.tight_layout()

    plot_path = os.path.join(output_dir, "aggression_metrics.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

    # 6. Game Dynamics
    logging.info("Analyzing Game Dynamics...")
    game_dynamics = df.groupby('public_discussion').agg(
        avg_play_time=('total_play_time', 'mean')
    ).reset_index()
    discussion_map = {True: 'with discussion', False: 'without discussion'}
    game_dynamics['public_discussion'] = game_dynamics['public_discussion'].map(discussion_map)
    
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.bar(game_dynamics['public_discussion'], game_dynamics['avg_play_time'], color=['#1f77b4', '#ff7f0e'])

    ax.set_ylabel('Average Play Time (seconds)')
    ax.set_title('Average Play Time per Game')
    plt.xticks(rotation=0)

    fig.tight_layout()

    plot_path = os.path.join(output_dir, "game_dynamics.png")
    save_plot(fig, plot_path)
    logging.info(f"Saved plot to {plot_path}")

def analyze_qualitative_data(output_dir):
    """Analyzes qualitative data and creates pie charts for type distribution by model."""
    logging.info("Starting Qualitative Analysis...")
    
    try:
        qual_df = pd.read_csv("./qualitative_analysis.csv")
        logging.info(f"Loaded {len(qual_df)} qualitative records.")
    except FileNotFoundError:
        logging.warning("qualitative_analysis.csv not found. Skipping qualitative analysis.")
        return
    
    if qual_df.empty:
        logging.warning("No qualitative data found. Skipping qualitative analysis.")
        return
    
    # Preprocess model names - remove provider prefix
    qual_df['model'] = qual_df['model'].str.split(':').str[-1]
    logging.info("Removed provider prefixes from model names.")
    
    # Filter out excluded models if any
    if EXCLUDED_MODELS:
        original_count = len(qual_df)
        qual_df = qual_df[~qual_df['model'].isin(EXCLUDED_MODELS)]
        logging.info(f"Filtered out {original_count - len(qual_df)} qualitative records for excluded models.")
    
    qual_output_dir = os.path.join(output_dir, "qualitative")
    if not os.path.exists(qual_output_dir):
        os.makedirs(qual_output_dir)
    
    # Get unique models and types for consistent coloring
    models = sorted(qual_df['model'].unique())  # Sort for consistency
    types = sorted(qual_df['type'].unique())    # Sort for consistency
    color_map = get_color_map(types)
    
    # Create individual model charts
    for model in models:
        model_data = qual_df[qual_df['model'] == model]
        type_counts = model_data['type'].value_counts()
        
        # Ensure consistent ordering and colors
        ordered_types = [t for t in types if t in type_counts.index]
        ordered_counts = [type_counts[t] for t in ordered_types]
        colors = [color_map[t] for t in ordered_types]
        
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.pie(ordered_counts, labels=ordered_types, autopct='%1.1f%%', startangle=90, colors=colors)
        ax.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle.
        ax.set_title(f"Type Distribution for {model}")
        
        safe_model_name = model.replace('/', '_').replace(':', '_')
        plot_path = os.path.join(qual_output_dir, f"type_distribution_{safe_model_name}.png")
        save_plot(fig, plot_path)
        logging.info(f"Created type distribution chart for {model}")
    
    # Create an overall summary chart
    overall_type_counts = qual_df.groupby(['model', 'type']).size().reset_index(name='count')
    pivot_df = overall_type_counts.pivot(index='model', columns='type', values='count').fillna(0)
    
    # Ensure consistent column ordering
    pivot_df = pivot_df.reindex(columns=types, fill_value=0)
    
    fig, ax = plt.subplots(figsize=(15, 8))
    colors = [color_map[t] for t in pivot_df.columns]
    pivot_df.plot(kind='bar', stacked=True, ax=ax, color=colors)
    
    ax.set_ylabel('Count')
    ax.set_title('Type Distribution Across All Models')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Type')
    
    fig.tight_layout()
    
    plot_path = os.path.join(qual_output_dir, "type_distribution_summary.png")
    save_plot(fig, plot_path)
    
    logging.info("Finished Qualitative Analysis")

def analyze_discussion_data(output_dir):
    """Analyzes discussion data and creates pie charts for category distribution by model."""
    logging.info("Starting Discussion Analysis...")
    
    try:
        disc_df = pd.read_csv("./discussion_analysis.csv")
        logging.info(f"Loaded {len(disc_df)} discussion records.")
    except FileNotFoundError:
        logging.warning("discussion_analysis.csv not found. Skipping discussion analysis.")
        return
    
    if disc_df.empty:
        logging.warning("No discussion data found. Skipping discussion analysis.")
        return
    
    # Preprocess model names - remove provider prefix
    disc_df['model'] = disc_df['model'].str.split(':').str[-1]
    logging.info("Removed provider prefixes from model names.")
    
    # Filter out excluded models if any
    if EXCLUDED_MODELS:
        original_count = len(disc_df)
        disc_df = disc_df[~disc_df['model'].isin(EXCLUDED_MODELS)]
        logging.info(f"Filtered out {original_count - len(disc_df)} discussion records for excluded models.")
    
    disc_output_dir = os.path.join(output_dir, "discussion")
    if not os.path.exists(disc_output_dir):
        os.makedirs(disc_output_dir)
    
    # Get unique models and categories for consistent coloring
    models = disc_df['model'].unique()
    categories = disc_df['category'].unique()
    color_map = get_color_map(categories)
    
    for model in models:
        model_data = disc_df[disc_df['model'] == model]
        category_counts = model_data['category'].value_counts()
        
        fig, ax = plt.subplots(figsize=(10, 10))
        colors = [color_map[c] for c in category_counts.index]
        ax.pie(category_counts, labels=category_counts.index, autopct='%1.1f%%', startangle=90, colors=colors)
        ax.axis('equal')
        ax.set_title(f"Discussion Category Distribution for {model}")
        
        safe_model_name = model.replace('/', '_').replace(':', '_')
        plot_path = os.path.join(disc_output_dir, f"category_distribution_{safe_model_name}.png")
        save_plot(fig, plot_path)
        logging.info(f"Created discussion category distribution chart for {model}")
        
    # Create an overall summary chart
    overall_category_counts = disc_df.groupby(['model', 'category']).size().reset_index(name='count')
    pivot_df = overall_category_counts.pivot(index='model', columns='category', values='count').fillna(0)
    
    fig, ax = plt.subplots(figsize=(15, 8))
    colors = [color_map[c] for c in pivot_df.columns]
    pivot_df.plot(kind='bar', stacked=True, ax=ax, color=colors)
    
    ax.set_ylabel('Count')
    ax.set_title('Discussion Category Distribution Across All Models')
    ax.set_xticklabels(pivot_df.index, rotation=45, ha="right")
    ax.legend(title='Category')
    
    fig.tight_layout()
    
    plot_path = os.path.join(disc_output_dir, "category_distribution_summary.png")
    save_plot(fig, plot_path)
    
    logging.info("Finished Discussion Analysis")

def main():
    df = pd.read_csv("../results.csv")
    logging.info(f"Loaded {len(df)} records.")

    # Identify self-play games
    game_model_counts = df.groupby('game_id')['model'].nunique()
    self_play_game_ids = game_model_counts[game_model_counts == 1].index
    
    # Create dataframes for each analysis type
    df_self_play = df[df['game_id'].isin(self_play_game_ids)]
    df_mixed_model = df[~df['game_id'].isin(self_play_game_ids)]

    # Filter mixed-model games to only include those with at least 3 unique models
    game_model_counts_mixed = df_mixed_model.groupby('game_id')['all_models'].first().apply(lambda x: len(x.split(';')))
    games_with_enough_models = game_model_counts_mixed[game_model_counts_mixed >= 3].index
    original_mixed_games = len(df_mixed_model['game_id'].unique())
    df_mixed_model = df_mixed_model[df_mixed_model['game_id'].isin(games_with_enough_models)]
    filtered_mixed_games = len(df_mixed_model['game_id'].unique())
    logging.info(f"Filtered mixed-model games: {original_mixed_games} -> {filtered_mixed_games} (kept games with >= 3 unique models)")

    # Run analyses
    run_analysis(df_self_play, os.path.join(OUTPUT_DIR, "self_play"), "Self-Play")
    run_analysis(df_mixed_model, os.path.join(OUTPUT_DIR, "mixed_model"), "Mixed-Model")
    analyze_qualitative_data(OUTPUT_DIR)
    analyze_discussion_data(OUTPUT_DIR)


if __name__ == "__main__":
    main()