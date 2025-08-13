import os
import re
import csv
import logging
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants for file paths, relative to the script's location in 'analysis/'
LOG_DIR = '../logs/'
RESULTS_FILE = '../results.csv'
OUTPUT_FILE = 'discussion_analysis.csv' # Output in the same directory as the script

def categorize_discussion(text):
    """
    Categorizes a discussion string into one of several predefined categories
    based on keywords. The order of checks is from most specific to most general.
    """
    text_lower = text.lower()

    # Category 1: Accusation/Challenge
    # High-signal words for calling someone out or expressing doubt.
    challenge_keywords = [
        'challenge', 'bluff', "don't buy it", 'convenient', 'keeping track',
        'hold on', 'wait a minute', 'i doubt', 'unlikely', 'miscounted', 'nice try'
    ]
    if any(keyword in text_lower for keyword in challenge_keywords):
        return 'Accusation/Challenge'

    # Category 2: Threat/Taunt
    # Intimidation, posturing, or other social commentary.
    threat_keywords = ['at your own risk', 'be more careful', 'lethal next turn', "can't let you", 'well played']
    if any(keyword in text_lower for keyword in threat_keywords):
        return 'Threat/Taunt'

    # Category 3: Information Reveal
    # Stating something about one's own hand (can be true or false).
    info_keywords = ['i have', 'i discard', "i'll discard", 'my card is']
    if any(keyword in text_lower for keyword in info_keywords):
        return 'Information Reveal'

    # Category 4: Justification
    # Explaining the 'why' of a move, often targeting another player.
    justification_keywords = [
        'accumulating coins', 'redistribute', 'getting dangerous', 'to build coins',
        'to create pressure', 'threat', 'sitting pretty', 'removing a'
    ]
    if any(keyword in text_lower for keyword in justification_keywords):
        return 'Justification'

    # Category 5: Action Declaration
    # The default, most neutral category for simple statements of action.
    return 'Action Declaration'

def process_log_file(filepath):
    """Processes a single log file and yields rows of structured discussion data."""
    game_id = os.path.basename(filepath).replace('.txt', '')
    
    # Corrected regex to capture player, model, and message from [DISCUSSION] lines
    discussion_pattern = re.compile(r'\[DISCUSSION\] (Player \d+) \((.*?)\): (.*)')

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                match = discussion_pattern.match(line.strip())
                if match:
                    player = match.group(1).strip()
                    model = match.group(2).strip()
                    message = match.group(3).strip()
                    category = categorize_discussion(message)
                    
                    yield {
                        'game_id': game_id,
                        'player': player,
                        'model': model,
                        'message': message,
                        'category': category
                    }
    except Exception as e:
        logging.error(f"Error processing file {filepath}: {e}")

def main():
    """Main function to process all relevant logs and write to a new CSV."""
    logging.info("Starting discussion log processing...")

    try:
        results_df = pd.read_csv(RESULTS_FILE)
        relevant_game_ids = set(results_df['game_id'].unique())
        logging.info(f"Loaded {len(relevant_game_ids)} unique game IDs from {RESULTS_FILE}.")
    except FileNotFoundError:
        logging.error(f"Results file not found at {RESULTS_FILE}. Aborting.")
        return

    if not os.path.isdir(LOG_DIR):
        logging.error(f"Log directory '{LOG_DIR}' not found.")
        return

    all_log_files = [f for f in os.listdir(LOG_DIR) if f.endswith('.txt')]
    
    # Filter logs to only include those present in results.csv
    log_files_to_process = [f for f in all_log_files if f.replace('.txt', '') in relevant_game_ids]

    if not log_files_to_process:
        logging.warning(f"No relevant log files found in '{LOG_DIR}' based on game IDs in {RESULTS_FILE}.")
        return

    logging.info(f"Found {len(log_files_to_process)} relevant log files to process...")

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['game_id', 'player', 'model', 'message', 'category']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        file_count = 0
        for filename in log_files_to_process:
            filepath = os.path.join(LOG_DIR, filename)
            for row in process_log_file(filepath):
                writer.writerow(row)
            file_count += 1
            if file_count % 50 == 0:
                logging.info(f"Processed {file_count}/{len(log_files_to_process)} files...")

    logging.info(f"Processing complete. Output written to '{OUTPUT_FILE}'.")

if __name__ == '__main__':
    main()
