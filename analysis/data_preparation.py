import pandas as pd
import os
import shutil

# 1. Read all game_ids from ../results.csv
results_df = pd.read_csv('../results.csv')
game_ids = set(results_df['game_id'])

# 2. List all log files in the ../logs/ directory
log_files = os.listdir('../logs/')

# 3. Create a new directory called ../data/
os.makedirs('../data/logs', exist_ok=True)

# 4. Copy ../results.csv to ../data/
shutil.copy('../results.csv', '../data/results.csv')

# 5. For each game_id, find the corresponding log file and copy it
for log_file in log_files:
    # The game_id is the part of the filename before the first dot
    game_id_from_log = log_file.split('.')[0]
    if game_id_from_log in game_ids:
        shutil.copy(os.path.join('../logs', log_file), os.path.join('../data/logs', log_file))

print("Script finished successfully.")
