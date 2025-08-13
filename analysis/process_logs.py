import os
import re
import csv
import logging
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Adjusted paths for being inside the 'analysis' directory
LOG_DIR = '../logs/'
RESULTS_FILE = '../results.csv'
OUTPUT_FILE = 'qualitative_analysis.csv' # Output in the same directory as the script

# Keywords for categorization
CATEGORIES = {
    'Risk Assessment': ['risk', 'chance', 'odds', 'safe', 'plausible', 'unlikely', 'desperate', 'sure', 'certain'],
    'Deception Rationale': ['bluff', 'pretend', 'lie', 'faking'],
    'Counter-Deception Rationale': ['challenge', 'doubt', 'suspect', 'history shows', "don't believe", "don't buy it", 'calling your bluff', 'suspicious'],
    'Opponent Modeling': ['player \d', 'opponent', 'their move', 'tendencies', 'history of', 'weak position', 'threat', 'leader', 'aggressively', 'passively'],
    'Resource Management': ['coin', 'coins', 'card', 'cards', 'influence', 'resources', 'wealth', 'income', 'money']
}

def categorize_reasoning(text):
    """Categorizes reasoning text based on keywords and returns a list of categories."""
    found_categories = set()
    lower_text = text.lower()
    for category, keywords in CATEGORIES.items():
        for keyword in keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', lower_text):
                found_categories.add(category)
                break # Move to the next category once a keyword is found
    if not found_categories:
        return ['Uncategorized']
    return list(found_categories)

def process_log_file(filepath):
    """Processes a single log file and yields rows of structured data."""
    game_id = os.path.basename(filepath).replace('.txt', '')
    current_round = 0
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                
                round_match = re.match(r'--- Round (\d+) ---', line)
                if round_match:
                    current_round = int(round_match.group(1))
                    continue

                if line.startswith('💭'):
                    reasoning_match = re.match(r'💭 (Player \d+)(?: \((.*?)\))?: (.*)', line)

                    if reasoning_match:
                        player = reasoning_match.group(1).strip()
                        model = reasoning_match.group(2) if reasoning_match.group(2) else 'human'
                        reasoning_text = reasoning_match.group(3).strip()
                        
                        types = categorize_reasoning(reasoning_text)
                        
                        for reasoning_type in types:
                            yield {
                                'game_id': game_id,
                                'round': current_round,
                                'player': player,
                                'model': model,
                                'type': reasoning_type,
                                'reasoning_text': reasoning_text
                            }
    except Exception as e:
        logging.error(f"Error processing file {filepath}: {e}")


def main():
    """Main function to process all logs and write to CSV."""
    logging.info("Starting log processing...")

    # --- New Pre-processing Step ---
    try:
        results_df = pd.read_csv(RESULTS_FILE)
        relevant_game_ids = set(results_df['game_id'].unique())
        logging.info(f"Loaded {len(relevant_game_ids)} unique game IDs from {RESULTS_FILE}.")
    except FileNotFoundError:
        logging.error(f"Results file not found at {RESULTS_FILE}. Aborting.")
        return
    # --- End of New Step ---

    if not os.path.isdir(LOG_DIR):
        logging.error(f"Log directory '{LOG_DIR}' not found.")
        return

    all_log_files = [f for f in os.listdir(LOG_DIR) if f.endswith('.txt')]
    
    # Filter logs to only include those in results.csv
    log_files_to_process = [f for f in all_log_files if f.replace('.txt', '') in relevant_game_ids]

    if not log_files_to_process:
        logging.warning(f"No relevant log files found in '{LOG_DIR}' based on game IDs in {RESULTS_FILE}.")
        return

    logging.info(f"Found {len(log_files_to_process)} relevant log files to process...")

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['game_id', 'round', 'player', 'model', 'type', 'reasoning_text']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        file_count = 0
        for filename in log_files_to_process:
            filepath = os.path.join(LOG_DIR, filename)
            for row in process_log_file(filepath):
                writer.writerow(row)
            file_count += 1
            if file_count % 20 == 0:
                logging.info(f"Processed {file_count}/{len(log_files_to_process)} files...")

    logging.info(f"Processing complete. Output written to '{OUTPUT_FILE}'.")


if __name__ == '__main__':
    main()