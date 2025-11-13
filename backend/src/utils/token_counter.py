import tiktoken
from typing import List, Dict, Any


def estimate_tokens(messages: List[Dict[str, Any]], model: str = "gpt-4") -> int:
    """
    Estimate token count for messages using tiktoken.
    
    Args:
        messages: List of message dictionaries with 'content' field
        model: Model name to determine encoding (default "gpt-4")
        
    Returns:
        Estimated number of tokens
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        # Fall back to cl100k_base if model not recognized
        encoding = tiktoken.get_encoding("cl100k_base")

    # Extract content from each message and concatenate
    all_content = "".join(msg.get("content", "") for msg in messages)
    
    # Encode the text
    tokens = encoding.encode(all_content)
    
    # Account for message overhead (approximation based on OpenAI's calculation)
    tokens_per_message = 4  # Overhead for each message
    total_tokens = len(tokens) + (len(messages) * tokens_per_message)

    return total_tokens


def estimate_tokens_from_text(text: str, model: str = "gpt-4") -> int:
    """
    Estimate token count for a single text string using tiktoken.
    
    Args:
        text: Text string to tokenize
        model: Model name to determine encoding (default "gpt-4")
        
    Returns:
        Estimated number of tokens
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        # Fall back to cl100k_base if model not recognized
        encoding = tiktoken.get_encoding("cl100k_base")

    tokens = encoding.encode(text)
    return len(tokens)