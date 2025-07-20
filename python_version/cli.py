import asyncio
import json
import os
import re
import traceback
from urllib.parse import urlparse
import httpx
import piexif
from colorama import init, Fore, Style
from tqdm import tqdm
from typing import Union, List, Dict, Tuple, Optional
from datetime import datetime

init()


class ImageDownloader:
    def __init__(self, output_dir: str, batch_size: int, retries: int, encoding: str, verbose: bool = False):
        self.output_dir = output_dir
        self.batch_size = batch_size
        self.retries = retries
        self.encoding = encoding
        self.verbose = verbose
        # Find the base output dir for the log file
        base_output_dir = output_dir
        if "downloaded_images" in base_output_dir:
            base_output_dir = base_output_dir.split("downloaded_images")[0] + "downloaded_images"
        self.malfunctioned_dates_log = os.path.join(base_output_dir, "malfunctioned_dates.txt")

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        return re.sub(r'[<>:"/\\|?*]', "", filename)

    @staticmethod
    def get_filename_from_url(url: str) -> str:
        path = urlparse(url).path
        filename = os.path.basename(path)
        return ImageDownloader.sanitize_filename(filename)

    def parse_chat_html(self, html_content: str) -> Tuple[List[Dict[str, str]], str, str]:
        """Parse chat HTML files to extract image URLs and metadata"""
        item_blocks = html_content.split('<div class="item">')[1:]
        extracted_data = []

        # Extract chat name from ui_crumb (last crumb is the chat name)
        chat_name_match = re.search(r'<div class="ui_crumb" >(.*?)</div>(?!.*<div class="ui_crumb")', html_content)
        chat_name = chat_name_match.group(1) if chat_name_match else "Unknown Chat"

        # No album URL for chats
        chat_url = ""

        for block in item_blocks:
            # Look for attachment links with image URLs
            attachment_matches = re.findall(r'<a class=\'attachment__link\' href=\'(https://[^\']*\.(?:jpg|jpeg|png|gif|webp)[^\']*)\'>([^<]*)</a>', block, re.IGNORECASE)
            
            if not attachment_matches:
                continue

            # Extract message date and ID
            date_match = re.search(r'<div class="message__header">(.*?)</div>', block)
            date_str = date_match.group(1).strip() if date_match else None
            
            # Clean up date string (remove editing info if present)
            if date_str:
                # Remove editing info like "(ред.)"
                date_str = re.sub(r'<span[^>]*>.*?</span>', '', date_str).strip()
            
            # Extract message ID
            message_id_match = re.search(r'data-id="(\d+)"', block)
            message_id = message_id_match.group(1) if message_id_match else "unknown"

            for img_url, display_url in attachment_matches:
                # Skip invalid URLs
                if not img_url or not img_url.startswith(('http://', 'https://')):
                    continue

                # Generate filename from message ID and original filename
                original_filename = self.get_filename_from_url(img_url)
                filename = f"msg_{message_id}_{original_filename}"

                photo_data = {
                    "image_url": img_url,
                    "filename": filename,
                    "vk_url": "",  # No VK photo URLs in chat messages
                    "date": date_str,
                    "message_id": message_id,
                    "comments": None  # No comments in chat messages
                }
                
                extracted_data.append(photo_data)

        return extracted_data, chat_name, chat_url

    def parse_html(self, html_content: str) -> Tuple[List[Dict[str, str]], str, str]:
        item_blocks = html_content.split('<div class="item">')[1:]
        extracted_data = []

        # Extract album name from ui_crumb
        album_name_match = re.search(r'<div class="ui_crumb" >(.*?)</div>', html_content)
        album_name = album_name_match.group(1) if album_name_match else "Unknown Album"

        # Extract album URL if available
        album_url_match = re.search(r'<a class="ui_crumb" href="(.*?)".*?>(.*?)</a>', html_content)
        album_url = album_url_match.group(1) if album_url_match else ""

        for block in item_blocks:
            img_match = re.search(r'<img src="(.*?)"', block)
            if not img_match:
                continue

            img_url = img_match.group(1)
            
            # Skip invalid URLs at parsing stage
            if not img_url or not img_url.startswith(('http://', 'https://')):
                continue
            
            # Extract VK photo URL
            vk_url_match = re.search(r'<a href="(https://vk\.com/photo\d+_\d+)"', block)
            vk_url = vk_url_match.group(1) if vk_url_match else ""

            # Extract filename from img alt attribute
            filename_match = re.search(r'alt="(.*?)"', block)
            filename = filename_match.group(1) if filename_match else self.get_filename_from_url(img_url)

            date_match = re.search(r'<div class="clear_fix">(.*?)</div>', block, re.DOTALL)
            date_str = None
            comments_info = None
            
            if date_match:
                full_date_str = date_match.group(1).strip()
                
                # Extract comments info
                comments_match = re.search(r'<a href="(.*?)"[^>]*>Комментарии \((\d+)\)</a>', full_date_str)
                if comments_match:
                    comments_info = {
                        "count": int(comments_match.group(2)),
                        "url": comments_match.group(1)
                    }
                
                # Clean date string
                cleaned_date_str = re.sub(r'<.*?>', '', full_date_str).strip()
                date_str = re.sub(r'\s*Комментарии.*', '', cleaned_date_str).strip()
                date_str = date_str.replace(' в ', ' ').replace('  ', ' ')

            photo_data = {
                "image_url": img_url,
                "filename": filename,
                "vk_url": vk_url,
                "date": date_str,
                "comments": comments_info
            }
            
            extracted_data.append(photo_data)

        return extracted_data, album_name, album_url

    async def download_image(self, client: httpx.AsyncClient, photo_data: Dict[str, str]):
        img_url = photo_data["image_url"]
        date_str = photo_data["date"]
        filename = photo_data["filename"]
        
        # Skip invalid URLs
        if not img_url or not img_url.startswith(('http://', 'https://')):
            if self.verbose:
                print(f"{Fore.YELLOW}Skipping invalid URL: {img_url}{Style.RESET_ALL}")
            return
        
        # Check if filename is already complete (for chat messages) or needs construction (for albums)
        if filename.startswith("msg_"):
            # Chat message format - filename is already complete
            img_name = filename
        else:
            # Album format - need to construct filename
            original_img_name = self.get_filename_from_url(img_url)  # e.g., "RFa2YGfxzZk.jpg"
            
            # Extract just the name part without extension from original
            original_name_no_ext = os.path.splitext(original_img_name)[0]
            original_ext = os.path.splitext(original_img_name)[1]
            
            # Combine VK filename with original name: 157793137_457307406_RFa2YGfxzZk.jpg
            img_name = f"{filename}_{original_name_no_ext}{original_ext}"
        
        img_path = os.path.join(self.output_dir, img_name)
        
        # Check if file already exists - skip download if it does
        if os.path.exists(img_path):
            # if self.verbose:
            #     print(f"{Fore.CYAN}File already exists, skipping: {img_name}{Style.RESET_ALL}")
            return
        
        attempt = 0
        while attempt < self.retries:
            try:
                response = await client.get(img_url, timeout=30.0)
                if response.status_code == 200:
                    with open(img_path, "wb") as img_file:
                        img_file.write(response.content)

                    if date_str:
                        try:
                            # Russian month names to month numbers (all grammatical cases)
                            months_map = {
                                # January - январь
                                "янв": 1, "января": 1, "январе": 1, "январём": 1, "январю": 1, "январь": 1,
                                # February - февраль
                                "фев": 2, "февраля": 2, "феврале": 2, "февралём": 2, "февралю": 2, "февраль": 2,
                                # March - март
                                "мар": 3, "марта": 3, "марте": 3, "мартом": 3, "марту": 3, "март": 3,
                                # April - апрель
                                "апр": 4, "апреля": 4, "апреле": 4, "апрелём": 4, "апрелю": 4, "апрель": 4,
                                # May - май
                                "май": 5, "мая": 5, "мае": 5, "маем": 5, "маю": 5,
                                # June - июнь
                                "июн": 6, "июня": 6, "июне": 6, "июнём": 6, "июню": 6, "июнь": 6,
                                # July - июль
                                "июл": 7, "июля": 7, "июле": 7, "июлём": 7, "июлю": 7, "июль": 7,
                                # August - август
                                "авг": 8, "августа": 8, "августе": 8, "августом": 8, "августу": 8, "август": 8,
                                # September - сентябрь
                                "сен": 9, "сентября": 9, "сентябре": 9, "сентябрём": 9, "сентябрю": 9, "сентябрь": 9,
                                # October - октябрь
                                "окт": 10, "октября": 10, "октябре": 10, "октябрём": 10, "октябрю": 10, "октябрь": 10,
                                # November - ноябрь
                                "ноя": 11, "ноября": 11, "ноябре": 11, "ноябрём": 11, "ноябрю": 11, "ноябрь": 11,
                                # December - декабрь
                                "дек": 12, "декабря": 12, "декабре": 12, "декабрём": 12, "декабрю": 12, "декабрь": 12
                            }
                            
                            # Check if this is a chat date format: "Вы, DD MMM YYYY в HH:MM:SS"
                            if date_str.startswith('Вы,'):
                                # Chat date format: "Вы, 21 окт 2023 в 17:54:53"
                                # Split by comma first to separate "Вы" from the rest
                                comma_parts = date_str.split(',', 1)
                                if len(comma_parts) != 2:
                                    raise ValueError(f"Invalid chat date format: {date_str}")
                                
                                # Parse the actual date part after "Вы, "
                                date_part = comma_parts[1].strip()  # "21 окт 2023 в 17:54:53"
                                parts = date_part.split()
                                
                                if len(parts) < 5:  # day, month, year, "в", time
                                    raise ValueError(f"Incomplete chat date format: expected at least 5 parts, got {len(parts)}: {parts}")
                                
                                day = parts[0]
                                month_str = parts[1]
                                year = parts[2]
                                # parts[3] should be "в"
                                time_str = parts[4]  # HH:MM:SS format
                                
                                # Parse Russian month name
                                month_key = month_str.lower()
                                if month_key not in months_map:
                                    # Try first 3 characters for abbreviated form
                                    month_key = month_str[:3].lower()
                                    if month_key not in months_map:
                                        raise ValueError(f"Unknown month in chat date: {month_str}")
                                month = months_map[month_key]
                                
                                # Convert time from HH:MM:SS to HH:MM (ignore seconds for EXIF)
                                time_parts = time_str.split(':')
                                if len(time_parts) >= 2:
                                    time_str = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}"
                                else:
                                    time_str = f"{time_parts[0].zfill(2)}:00"
                            else:
                                # Original album date format
                                parts = date_str.split()
                                
                                # Remove 'в' (meaning 'at') if present
                                if 'в' in parts:
                                    parts.remove('в')
                                
                                if len(parts) < 4:
                                    raise ValueError(f"Unsupported date format: expected at least 4 parts, got {len(parts)}: {parts}")
                                
                                # Extract components - handle various formats
                                day = parts[0]
                                month_str = parts[1]
                                year = parts[2]
                                time_str = parts[3]
                                
                                # Check if month_str is numeric (for some formats) or text (for albums)
                                try:
                                    # Try to parse as numeric month first
                                    month = int(month_str)
                                    if month < 1 or month > 12:
                                        raise ValueError(f"Invalid numeric month: {month}")
                                except ValueError:
                                    # If not numeric, try Russian month names (for albums)
                                    month_key = month_str.lower()
                                    if month_key not in months_map:
                                        # Try first 3 characters for abbreviated form
                                        month_key = month_str[:3].lower()
                                        if month_key not in months_map:
                                            raise ValueError(f"Unknown month: {month_str}")
                                    month = months_map[month_key]
                                
                                # Handle times without leading zeros and various formats
                                if ':' in time_str:
                                    time_parts = time_str.split(':')
                                    if len(time_parts) == 2:
                                        hour, minute = time_parts
                                        # Ensure 2-digit format for hours and minutes
                                        time_str = f"{hour.zfill(2)}:{minute.zfill(2)}"
                                    else:
                                        raise ValueError(f"Invalid time format: {time_str}")
                                else:
                                    # Handle case where time has no colon - treat as hour only
                                    hour = time_str
                                    time_str = f"{hour.zfill(2)}:00"
                            
                            # Ensure day is 2 digits
                            day_padded = day.zfill(2)
                            month_padded = str(month).zfill(2)
                            
                            # Build the datetime string for parsing
                            datetime_str = f"{day_padded} {month_padded} {year} {time_str}"
        
                            try:
                                dt = datetime.strptime(datetime_str, "%d %m %Y %H:%M")
                            except ValueError as e:
                                error_msg = str(e) if str(e) else "Unknown datetime parsing error"
                                stack_trace = traceback.format_exc()
                                if self.verbose:
                                    print(f"{Fore.YELLOW}Could not parse date for {img_name}: {error_msg}. Original date string: '{date_str}'{Style.RESET_ALL}")
                                with open(self.malfunctioned_dates_log, "a", encoding="utf-8") as log_file:
                                    log_file.write(f"[DATETIME_PARSING_ERROR] Image: {img_name}, VK_URL: {photo_data.get('vk_url', 'N/A')}, Original_Date: '{date_str}', Normalized_Date: '{datetime_str}', Error: {error_msg}, Type: {type(e).__name__}\n")
                                    log_file.write(f"[DATETIME_PARSING_ERROR_STACK_TRACE] Image: {img_name}\n{stack_trace}\n")
                                return

                            # Set EXIF data with fallback strategies
                            exif_success = False
                            try:
                                exif_dict = {"Exif": {piexif.ExifIFD.DateTimeOriginal: dt.strftime("%Y:%m:%d %H:%M:%S")}}
                                exif_bytes = piexif.dump(exif_dict)
                                piexif.insert(exif_bytes, img_path)
                                exif_success = True
                            except piexif.InvalidImageDataError:
                                # Try to remove existing EXIF data first, then insert new EXIF
                                try:
                                    if self.verbose:
                                        print(f"{Fore.YELLOW}Attempting to remove existing EXIF data for {img_name}{Style.RESET_ALL}")
                                    piexif.remove(img_path)
                                    # Now try to insert new EXIF data
                                    exif_dict = {"Exif": {piexif.ExifIFD.DateTimeOriginal: dt.strftime("%Y:%m:%d %H:%M:%S")}}
                                    exif_bytes = piexif.dump(exif_dict)
                                    piexif.insert(exif_bytes, img_path)
                                    exif_success = True
                                    if self.verbose:
                                        print(f"{Fore.GREEN}Successfully set EXIF data after removing corrupted EXIF for {img_name}{Style.RESET_ALL}")
                                except Exception as fallback_error:
                                    # If removing and re-inserting fails, skip EXIF completely
                                    if self.verbose:
                                        print(f"{Fore.YELLOW}Could not set EXIF data for {img_name} (skipping EXIF): {fallback_error}{Style.RESET_ALL}")
                                    with open(self.malfunctioned_dates_log, "a", encoding="utf-8") as log_file:
                                        log_file.write(f"[EXIF_ERROR] Image: {img_name}, VK_URL: {photo_data.get('vk_url', 'N/A')}, Original_Date: '{date_str}', Normalized_Date: '{datetime_str}', Parsed_DateTime: '{dt}', Error: EXIF data corrupted/incompatible - skipped, Type: InvalidImageDataError, File_Path: {img_path}\n")
                            except Exception as exif_error:
                                stack_trace = traceback.format_exc()
                                if self.verbose:
                                    print(f"{Fore.YELLOW}Could not set EXIF data for {img_name}: {exif_error}{Style.RESET_ALL}")
                                with open(self.malfunctioned_dates_log, "a", encoding="utf-8") as log_file:
                                    log_file.write(f"[EXIF_ERROR] Image: {img_name}, VK_URL: {photo_data.get('vk_url', 'N/A')}, Original_Date: '{date_str}', Normalized_Date: '{datetime_str}', Parsed_DateTime: '{dt}', Error: {exif_error}, Type: {type(exif_error).__name__}, File_Path: {img_path}\n")
                                    log_file.write(f"[EXIF_ERROR_STACK_TRACE] Image: {img_name}\n{stack_trace}\n")

                            # Set file modification and access times
                            timestamp_success = False
                            try:
                                os.utime(img_path, (dt.timestamp(), dt.timestamp()))
                                timestamp_success = True
                            except Exception as utime_error:
                                stack_trace = traceback.format_exc()
                                if self.verbose:
                                    print(f"{Fore.YELLOW}Could not set file timestamps for {img_name}: {utime_error}{Style.RESET_ALL}")
                                with open(self.malfunctioned_dates_log, "a", encoding="utf-8") as log_file:
                                    log_file.write(f"[TIMESTAMP_ERROR] Image: {img_name}, VK_URL: {photo_data.get('vk_url', 'N/A')}, Original_Date: '{date_str}', Normalized_Date: '{datetime_str}', Parsed_DateTime: '{dt}', Timestamp: {dt.timestamp()}, Error: {utime_error}, Type: {type(utime_error).__name__}, File_Path: {img_path}\n")
                                    log_file.write(f"[TIMESTAMP_ERROR_STACK_TRACE] Image: {img_name}\n{stack_trace}\n")
                            
                            # Success case - no logging needed for malfunctioned_dates.txt (errors only)
                            if self.verbose and exif_success and timestamp_success:
                                print(f"{Fore.GREEN}Successfully processed {img_name} with date {dt}{Style.RESET_ALL}")
                        except Exception as e:
                            error_msg = f"{type(e).__name__}: {str(e)}" if str(e) else f"{type(e).__name__}: Unknown error"
                            stack_trace = traceback.format_exc()
                            if self.verbose:
                                print(f"{Fore.RED}An unexpected error occurred while setting date for {img_name}: {error_msg}{Style.RESET_ALL}")
                            with open(self.malfunctioned_dates_log, "a", encoding="utf-8") as log_file:
                                log_file.write(f"[UNEXPECTED_ERROR] Image: {img_name}, VK_URL: {photo_data.get('vk_url', 'N/A')}, Original_Date: '{date_str}', Error: {error_msg}, File_Path: {img_path}\n")
                                log_file.write(f"[UNEXPECTED_ERROR_STACK_TRACE] Image: {img_name}\n{stack_trace}\n")
                    return
                elif response.status_code == 404:
                    # 404 is OK, no need for retry
                    if self.verbose:
                        print(f"{Fore.YELLOW}Image not found (404): {img_url}{Style.RESET_ALL}")
                    return
                else:
                    if self.verbose:
                        print(f"{Fore.RED}Failed to download: {img_url} (status code: {response.status_code}){Style.RESET_ALL}")
            except Exception as e:
                print(f"{Fore.RED}Error downloading {img_url}: {str(e)}{Style.RESET_ALL}")
            attempt += 1
            if attempt < self.retries:
                print(f"{Fore.YELLOW}Retrying {img_url} in 2 seconds... (Attempt {attempt + 1}){Style.RESET_ALL}")
                await asyncio.sleep(2)

    async def process_batch(self, batch: List[Dict[str, str]], pbar: tqdm):
        async with httpx.AsyncClient() as client:
            tasks = [self.download_image(client, photo_data) for photo_data in batch]
            await asyncio.gather(*tasks)
            pbar.update(len(batch))

    async def download_chat_images(self, input_dir: str, chat_name: str = "chat") -> None:
        """Download images from all HTML files in a chat directory"""
        html_files = [f for f in os.listdir(input_dir) if f.lower().endswith(".html")]
        all_images_data = []
        
        for html_file in html_files:
            input_file_path = os.path.join(input_dir, html_file)
            with open(input_file_path, "r", encoding=self.encoding) as file:
                html_content = file.read()
            
            images_data, parsed_chat_name, _ = self.parse_chat_html(html_content)
            all_images_data.extend(images_data)
            
            if not chat_name or chat_name == "chat":
                chat_name = parsed_chat_name

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        # Create JSON metadata file
        metadata = {
            "chat_name": chat_name,
            "date_created": datetime.now().isoformat(),
            "total_images": len(all_images_data),
            "total_files_processed": len(html_files),
            "images": all_images_data
        }
        
        metadata_path = os.path.join(self.output_dir, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        with tqdm(total=len(all_images_data), desc=f"Downloading chat '{chat_name}' images", unit="img") as pbar:
            for i in range(0, len(all_images_data), self.batch_size):
                batch = all_images_data[i : i + self.batch_size]
                await self.process_batch(batch, pbar)

    async def download_images(self, input_file: str, album_name: str = "album") -> None:
        with open(input_file, "r", encoding=self.encoding) as file:
            html_content = file.read()

        images_data, parsed_album_name, album_url = self.parse_html(html_content)

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        # Create JSON metadata file
        metadata = {
            "album_name": parsed_album_name,
            "album_url": album_url,
            "date_created": datetime.now().isoformat(),
            "total_images": len(images_data),
            "images": images_data
        }
        
        metadata_path = os.path.join(self.output_dir, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        with tqdm(total=len(images_data), desc=f"Downloading album '{parsed_album_name}'", unit="img") as pbar:
            for i in range(0, len(images_data), self.batch_size):
                batch = images_data[i : i + self.batch_size]
                await self.process_batch(batch, pbar)


class CommentDeleter:
    def __init__(self, access_token: str, sleep_time: float, exclude_ids: List[str]):
        self.access_token = access_token
        self.sleep_time = sleep_time
        self.exclude_ids = exclude_ids

    @staticmethod
    def parse_html_file(file_path: str) -> List[str]:
        with open(file_path, "r", encoding="windows-1251") as file:
            content = file.read()

        pattern = r'href="https://vk\.com/(wall-?\d+_\d+(?:\?reply=\d+(?:&thread=\d+)?)?)"'
        matches = re.findall(pattern, content)
        return matches

    @staticmethod
    def extract_comment_details(wall_id: str) -> Tuple[str, str]:
        parts = wall_id.split("_")
        owner_id = parts[0].replace("wall", "")
        if "?reply=" in parts[1]:
            comment_id = parts[1].split("?reply=")[1].split("&")[0]
        else:
            comment_id = parts[1].split("?")[0]
        return owner_id, comment_id

    @staticmethod
    def chunk_list(lst: List[str], chunk_size: int):
        for i in range(0, len(lst), chunk_size):
            yield lst[i : i + chunk_size]

    def build_vk_execute_code(self, wall_ids: List[str]) -> List[str]:
        execute_commands = []
        for batch in self.chunk_list(wall_ids, 25):
            execute_code = [f'API.wall.deleteComment({{"owner_id": {self.extract_comment_details(wall_id)[0]}, "comment_id": {self.extract_comment_details(wall_id)[1]}}})' for wall_id in batch]
            execute_commands.append(f'return [{",".join(execute_code)}];')
        return execute_commands

    async def execute_vk_command(self, command: str) -> Dict:
        url = "https://api.vk.com/method/execute"
        params = {"access_token": self.access_token, "v": "5.131", "code": command}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)

        if response.status_code == 200:
            return response.json()
        else:
            response.raise_for_status()
            return {}

    async def delete_comments(self, input_dir: str, output_file: str) -> None:
        wall_ids = []
        for filename in os.listdir(input_dir):
            if filename.endswith(".html"):
                wall_ids.extend(self.parse_html_file(os.path.join(input_dir, filename)))

        filtered_wall_ids = [wall_id for wall_id in wall_ids if not any(exclude_id in wall_id.split("_")[0] for exclude_id in self.exclude_ids)]

        with open(output_file, "w", encoding="utf-8") as file:
            for wall_id in filtered_wall_ids:
                file.write(wall_id + "\n")

        print(f"{Fore.GREEN}Extracted {len(filtered_wall_ids)} wall IDs to {output_file}{Style.RESET_ALL}")

        print(f"{Fore.YELLOW}Review the wall IDs in file {output_file} that will be deleted.{Style.RESET_ALL}")
        proceed = input(f"{Fore.CYAN}Do you want to proceed with the deletion (yes/no)? {Style.RESET_ALL}")

        if proceed.lower() != "yes":
            print(f"{Fore.RED}Deletion process aborted by the user.{Style.RESET_ALL}")
            return

        execute_codes = self.build_vk_execute_code(filtered_wall_ids)

        total_successful = 0
        total_failed = 0

        with tqdm(total=len(execute_codes), desc="Deleting comments", unit="batch") as pbar:
            for command in execute_codes:
                result = await self.execute_vk_command(command)
                if "response" in result:
                    successful = result["response"].count(True)
                    failed = result["response"].count(False)
                    total_successful += successful
                    total_failed += failed
                    print(f"{Fore.GREEN} Successfully deleted {successful} comments; {Fore.YELLOW}Failed to delete {failed} comments (possibly already deleted or in closed group/page).{Style.RESET_ALL}")
                else:
                    print(f"{Fore.RED}Error in API response: {result}{Style.RESET_ALL}")
                    break
                await asyncio.sleep(self.sleep_time)
                pbar.update(1)

        print(f"\n{Fore.GREEN}Final Summary:{Style.RESET_ALL}")
        print(f"{Fore.GREEN}Successfully deleted {total_successful} comments in total.{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Failed to delete {total_failed} comments in total (possibly already deleted or in closed group/page).{Style.RESET_ALL}")


class Validator:
    @staticmethod
    def validate_input_dir(input_dir: str, mode: str) -> str:
        input_dir = input_dir.strip('"')
        if not os.path.exists(input_dir):
            raise ValueError(f"{Fore.RED}The specified input path does not exist.{Style.RESET_ALL}")

        if mode == "1":
            if not input_dir.lower().endswith(".html"):
                raise ValueError(f"{Fore.RED}For mode 1, input_dir should be a single .html file.{Style.RESET_ALL}")
        elif mode == "2":
            if not os.path.isdir(input_dir):
                raise ValueError(f"{Fore.RED}For mode 2, input should be the path to the Archive directory.{Style.RESET_ALL}")
        elif mode == "3":
            if not os.path.isdir(input_dir):
                raise ValueError(f"{Fore.RED}For mode 3, input_dir should be a directory containing .html files, not a specific file.{Style.RESET_ALL}")
            html_files = [f for f in os.listdir(input_dir) if f.lower().endswith(".html")]
            if not html_files:
                raise ValueError(f"{Fore.RED}The input directory for mode 3 should contain at least one .html file.{Style.RESET_ALL}")
        elif mode == "4":
            if not os.path.isdir(input_dir):
                raise ValueError(f"{Fore.RED}For mode 4, input_dir should be the path to the messages directory (e.g., Archive/messages/<chat_id>).{Style.RESET_ALL}")
            html_files = [f for f in os.listdir(input_dir) if f.lower().endswith(".html")]
            if not html_files:
                raise ValueError(f"{Fore.RED}The input directory for mode 4 should contain at least one .html file.{Style.RESET_ALL}")

        return input_dir

    @staticmethod
    def validate_output_dir(output_dir: str) -> None:
        if os.path.exists(output_dir) and not os.path.isdir(output_dir):
            raise ValueError(f"{Fore.RED}The specified output path exists but is not a directory.{Style.RESET_ALL}")

    @staticmethod
    def validate_batch_size(batch_size: Union[str, int]) -> int:
        try:
            batch_size = int(batch_size)
            if batch_size <= 0:
                raise ValueError
        except ValueError:
            raise ValueError(f"{Fore.RED}Batch size must be a positive integer.{Style.RESET_ALL}")
        return batch_size

    @staticmethod
    def validate_retries(retries: Union[str, int]) -> int:
        try:
            retries = int(retries)
            if retries < 0:
                raise ValueError
        except ValueError:
            raise ValueError(f"{Fore.RED}Number of retries must be a non-negative integer.{Style.RESET_ALL}")
        return retries

    @staticmethod
    def validate_sleep_time(sleep_time: Union[str, float]) -> float:
        try:
            sleep_time = float(sleep_time)
            if sleep_time < 0:
                raise ValueError
        except ValueError:
            raise ValueError(f"{Fore.RED}Sleep time must be a non-negative number.{Style.RESET_ALL}")
        return sleep_time


async def main():
    print(f"{Fore.CYAN}Select mode that you want to use:{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[1] Download single album{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[2] Download all albums{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[3] Delete all comments{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[4] Download images from chat messages{Style.RESET_ALL}")
    mode = input(f"{Fore.CYAN}Enter the number corresponding to the mode: {Style.RESET_ALL}")

    if mode not in ["1", "2", "3", "4"]:
        print(f"{Fore.RED}Invalid selection. Please choose 1, 2, 3, or 4.{Style.RESET_ALL}")
        return

    try:
        if mode == "1":
            input_file = input(f"{Fore.CYAN}Enter the path to the HTML file for a single album (Example: Archive/photos/photo-albums/-15.html): {Style.RESET_ALL}")
            input_file = Validator.validate_input_dir(input_file, mode)

            output_dir = input(f"{Fore.CYAN}Enter the directory to save downloaded images (default: downloaded_images): {Style.RESET_ALL}") or "downloaded_images"
            Validator.validate_output_dir(output_dir)

            batch_size = input(f"{Fore.CYAN}Enter the number of images to download at a time (default: 50): {Style.RESET_ALL}") or 50
            batch_size = Validator.validate_batch_size(batch_size)

            encoding = input(f"{Fore.CYAN}Enter the encoding of the HTML file (default: windows-1251): {Style.RESET_ALL}") or "windows-1251"

            retries = input(f"{Fore.CYAN}Enter the number of retries for downloading an image (default: 3): {Style.RESET_ALL}") or 3
            retries = Validator.validate_retries(retries)

            verbose = input(f"{Fore.CYAN}Enable verbose logging for date errors (yes/no, default: no): {Style.RESET_ALL}").lower() == 'yes'

            with open(input_file, "r", encoding=encoding) as file:
                html_content = file.read()
            
            title_match = re.search(r'<div class="ui_crumb" >(.*?)</div>', html_content)
            album_name = title_match.group(1) if title_match else os.path.splitext(os.path.basename(input_file))[0]
            
            output_dir_album = os.path.join(output_dir, album_name)

            downloader = ImageDownloader(output_dir_album, batch_size, retries, encoding, verbose)
            await downloader.download_images(input_file, album_name)
            print(f"{Fore.GREEN}Album '{album_name}' has been downloaded.{Style.RESET_ALL}")

        elif mode == "2":
            archive_path = input(f"{Fore.CYAN}Enter the path to the Archive directory: {Style.RESET_ALL}")
            archive_path = Validator.validate_input_dir(archive_path, mode)

            albums_dir = os.path.join(archive_path, "photos", "photo-albums")
            if not os.path.exists(albums_dir) or not os.path.isdir(albums_dir):
                raise ValueError(f"{Fore.RED}Could not find 'photos/photo-albums' directory in '{archive_path}'.{Style.RESET_ALL}")

            html_files = [f for f in os.listdir(albums_dir) if f.lower().endswith(".html")]
            if not html_files:
                raise ValueError(f"{Fore.RED}No HTML files found in '{albums_dir}'.{Style.RESET_ALL}")

            base_output_dir = input(f"{Fore.CYAN}Enter the base directory to save downloaded images (default: downloaded_images): {Style.RESET_ALL}") or "downloaded_images"
            if not os.path.exists(base_output_dir):
                os.makedirs(base_output_dir)

            batch_size = input(f"{Fore.CYAN}Enter the number of images to download at a time (default: 50): {Style.RESET_ALL}") or 50
            batch_size = Validator.validate_batch_size(batch_size)

            encoding = input(f"{Fore.CYAN}Enter the encoding of the HTML files (default: windows-1251): {Style.RESET_ALL}") or "windows-1251"

            retries = input(f"{Fore.CYAN}Enter the number of retries for downloading an image (default: 3): {Style.RESET_ALL}") or 3
            retries = Validator.validate_retries(retries)

            verbose = input(f"{Fore.CYAN}Enable verbose logging for date errors (yes/no, default: no): {Style.RESET_ALL}").lower() == 'yes'

            print(f"{Fore.CYAN}Found {len(html_files)} albums to download.{Style.RESET_ALL}")

            for html_file in html_files:
                input_file_path = os.path.join(albums_dir, html_file)
                with open(input_file_path, "r", encoding=encoding) as file:
                    html_content = file.read()
                
                title_match = re.search(r'<div class="ui_crumb" >(.*?)</div>', html_content)
                album_name = title_match.group(1) if title_match else os.path.splitext(html_file)[0]

                output_dir = os.path.join(base_output_dir, album_name)
                
                downloader = ImageDownloader(output_dir, batch_size, retries, encoding, verbose)
                await downloader.download_images(input_file_path, album_name)
            
            print(f"\n{Fore.GREEN}All albums have been downloaded to '{base_output_dir}'.{Style.RESET_ALL}")

        elif mode == "3":
            input_dir = input(f"{Fore.CYAN}Enter the directory containing the HTML files for comment deletion (Example: Archive/comments): {Style.RESET_ALL}")
            input_dir = Validator.validate_input_dir(input_dir, mode)

            output_file = input(f"{Fore.CYAN}Enter the output file to store the extracted wall ID. Should end with .txt. (default: to_delete_comment_ids.txt): {Style.RESET_ALL}") or "to_delete_comment_ids.txt"
            access_token = input(f"{Fore.CYAN}Enter the VK API access token for deleting comments: {Style.RESET_ALL}")

            if not access_token:
                raise ValueError(f"{Fore.RED}Error: access_token is required for deleting comments.{Style.RESET_ALL}")

            exclude_ids = input(f"{Fore.CYAN}Enter group/user IDs to exclude (comma-separated, e.g., -123456789,123456789): {Style.RESET_ALL}")
            exclude_ids = [id.strip() for id in exclude_ids.split(",") if id.strip()]

            sleep_time = input(f"{Fore.CYAN}Enter the sleep time between API requests in seconds (default: 1): {Style.RESET_ALL}") or 1
            sleep_time = Validator.validate_sleep_time(sleep_time)

            deleter = CommentDeleter(access_token, sleep_time, exclude_ids)
            await deleter.delete_comments(input_dir, output_file)

        elif mode == "4":
            input_dir = input(f"{Fore.CYAN}Enter the path to the messages directory (Example: Archive/messages/<chat_id>): {Style.RESET_ALL}")
            input_dir = Validator.validate_input_dir(input_dir, mode)

            output_dir = input(f"{Fore.CYAN}Enter the directory to save downloaded images (default: downloaded_chat_images): {Style.RESET_ALL}") or "downloaded_chat_images"
            Validator.validate_output_dir(output_dir)

            batch_size = input(f"{Fore.CYAN}Enter the number of images to download at a time (default: 50): {Style.RESET_ALL}") or 50
            batch_size = Validator.validate_batch_size(batch_size)

            encoding = input(f"{Fore.CYAN}Enter the encoding of the HTML files (default: windows-1251): {Style.RESET_ALL}") or "windows-1251"

            retries = input(f"{Fore.CYAN}Enter the number of retries for downloading an image (default: 3): {Style.RESET_ALL}") or 3
            retries = Validator.validate_retries(retries)

            verbose = input(f"{Fore.CYAN}Enable verbose logging for date errors (yes/no, default: no): {Style.RESET_ALL}").lower() == 'yes'

            # Extract chat name from directory path
            chat_name = os.path.basename(input_dir.rstrip(os.sep))
            if not chat_name or chat_name == ".":
                chat_name = "Unknown_Chat"
            
            output_dir_chat = os.path.join(output_dir, chat_name)

            downloader = ImageDownloader(output_dir_chat, batch_size, retries, encoding, verbose)
            await downloader.download_chat_images(input_dir, chat_name)
            print(f"{Fore.GREEN}Chat '{chat_name}' images have been downloaded.{Style.RESET_ALL}")

    except ValueError as e:
        print(f"{Fore.RED}{str(e)}{Style.RESET_ALL}")

    finally:
        input(f"{Fore.CYAN}Press any button to exit...{Style.RESET_ALL}")


if __name__ == "__main__":
    asyncio.run(main())
