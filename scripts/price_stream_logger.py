import requests
import pandas as pd
import time
from datetime import datetime
import base64
import struct
from typing import Tuple, Optional
import numpy as np

class PriceStreamLogger:
    def __init__(self):
        self.data = []
        self.last_timestamp = 0
        self.session = requests.Session()
        
    def read_varint(self, data: bytes, offset: int) -> Tuple[int, int]:
        """Read a variable-length integer from bytes."""
        value = 0
        shift = 0
        current_offset = offset
        
        while current_offset < len(data):
            byte = data[current_offset]
            value |= (byte & 0x7F) << shift
            current_offset += 1
            if not (byte & 0x80):
                break
            shift += 7
            
        return value, current_offset

    def read_float(self, data: bytes, offset: int) -> float:
        """Read a 32-bit float from bytes."""
        return struct.unpack('<f', data[offset:offset+4])[0]

    def process_frame(self, frame_data: bytes) -> Optional[dict]:
        """Process a single data frame and extract price information."""
        try:
            offset = 0
            
            # Read tag byte
            tag_byte = frame_data[offset]
            offset += 1
            if (tag_byte >> 3) != 1:
                return None
            
            # Read timestamp
            timestamp, offset = self.read_varint(frame_data, offset)
            date = datetime.fromtimestamp(timestamp)
            
            if timestamp <= self.last_timestamp:
                return None
                
            self.last_timestamp = timestamp
            
            # Initialize all fields with NaN
            result = {
                'timestamp': date,
                'open': np.nan,
                'close': np.nan,
                'low': np.nan,
                'high': np.nan,
                'volume': np.nan
            }
            
            # Read all available fields
            while offset < len(frame_data):
                field_tag = frame_data[offset]
                offset += 1
                field_num = field_tag >> 3
                
                if 2 <= field_num <= 6:
                    value = self.read_float(frame_data, offset)
                    offset += 4
                    if field_num == 2:
                        result['open'] = value
                    elif field_num == 3:
                        result['close'] = value
                    elif field_num == 4:
                        result['low'] = value
                    elif field_num == 5:
                        result['high'] = value
                    elif field_num == 6:
                        result['volume'] = value
                else:
                    break
            
            return result
            
        except Exception as e:
            print(f'Error processing frame: {str(e)}')
            return None

    def process_response(self, response: str) -> Optional[dict]:
        """Process base64 encoded response and extract frame data."""
        try:
            binary = base64.b64decode(response)
            bytes_data = bytearray(binary)
            
            offset = 0
            while offset < len(bytes_data):
                frame_tag = bytes_data[offset]
                if frame_tag == 0x0a:
                    offset += 1
                    frame_length = bytes_data[offset]
                    offset += 1
                    if frame_length > 0 and offset + frame_length <= len(bytes_data):
                        frame_data = bytes_data[offset:offset + frame_length]
                        result = self.process_frame(frame_data)
                        if result:
                            return result
                        offset += frame_length
                    else:
                        break
                else:
                    offset += 1
                    
        except Exception as e:
            if not str(e).startswith('Invalid base64'):
                print(f'Error processing response: {str(e)}')
        return None

    def connect_and_log(self):
        """Connect to the price stream and continuously log data."""
        url = 'https://grpc.hypurr.fun/hypurr.Static/HyperliquidLaunchCandleStream'
        headers = {
            'content-type': 'application/grpc-web-text',
            'x-grpc-web': '1'
        }
        payload = 'AAAAAAcIiTsSAjVt'

        print("Connecting to price stream...")
        
        try:
            with self.session.post(url, headers=headers, data=payload, stream=True) as response:
                if response.status_code != 200:
                    print(f"Error: HTTP {response.status_code}")
                    return

                print("Connected successfully! Collecting data...")
                buffer = ''
                
                for chunk in response.iter_content(chunk_size=None):
                    if chunk:
                        try:
                            new_data = chunk.decode('utf-8')
                            buffer += new_data
                            
                            while len(buffer) >= 2:
                                result = self.process_response(buffer)
                                if result:
                                    self.data.append(result)
                                    print(f"Time: {result['timestamp']}, Open: ${result['open']:.4f}, Close: ${result['close']:.4f}, High: ${result['high']:.4f}, Low: ${result['low']:.4f}, Volume: {result['volume']:.2f}")
                                buffer = ''
                        except Exception as e:
                            buffer = ''

        except Exception as e:
            print(f'Stream error: {str(e)}')

    def get_dataframe(self) -> pd.DataFrame:
        """Convert collected data to a pandas DataFrame."""
        if not self.data:
            return pd.DataFrame(columns=['timestamp', 'open', 'close', 'high', 'low', 'volume']).set_index('timestamp')
        
        df = pd.DataFrame(self.data)
        df = df.set_index('timestamp')
        
        # Sort by timestamp
        df = df.sort_index()
        
        return df

    def save_to_csv(self, filename: str = 'price_data.csv'):
        """Save the current data to a CSV file."""
        df = self.get_dataframe()
        df.to_csv(filename)
        print(f'\nData saved to {filename}')
        
        # Print basic stats about saved data
        print(f"Saved {len(df)} records")
        print(f"Time range: {df.index.min()} to {df.index.max()}")
        
        if len(df) > 1:
            # Calculate average time between entries
            time_diffs = pd.Series(df.index).diff().dropna()
            avg_interval = time_diffs.mean().total_seconds() / 60  # Convert to minutes
            print(f"Average time between entries: {avg_interval:.2f} minutes")

def main():
    logger = PriceStreamLogger()
    print("Starting price stream logger...")
    
    try:
        logger.connect_and_log()
    except KeyboardInterrupt:
        print("\nStopping price stream logger...")
        if len(logger.data) > 0:
            logger.save_to_csv()

if __name__ == "__main__":
    main() 