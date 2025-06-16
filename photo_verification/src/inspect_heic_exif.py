import os
from PIL import Image, ExifTags

def get_decimal_from_dms(dms, ref):
    # dms is a tuple of IFDRational or float
    def to_float(x):
        try:
            return float(x)
        except Exception:
            return x[0] / x[1]
    degrees = to_float(dms[0])
    minutes = to_float(dms[1])
    seconds = to_float(dms[2])
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def print_jpg_gps_direction(jpg_path):
    image = Image.open(jpg_path)
    exif = image._getexif()
    if not exif:
        print("No EXIF data found.")
        return
    gps_info = None
    direction = None
    for tag_id, value in exif.items():
        tag = ExifTags.TAGS.get(tag_id, tag_id)
        if tag == 'GPSInfo':
            gps_info = value
    if not gps_info:
        print("No GPSInfo found in EXIF data.")
        return
    gps_data = {}
    for key in gps_info.keys():
        decode = ExifTags.GPSTAGS.get(key, key)
        gps_data[decode] = gps_info[key]
    # Print all GPS data
    print("GPS Data:")
    for k, v in gps_data.items():
        print(f"  {k}: {v}")
    # Extract latitude and longitude
    if 'GPSLatitude' in gps_data and 'GPSLatitudeRef' in gps_data:
        lat = get_decimal_from_dms(gps_data['GPSLatitude'], gps_data['GPSLatitudeRef'])
    else:
        lat = None
    if 'GPSLongitude' in gps_data and 'GPSLongitudeRef' in gps_data:
        lon = get_decimal_from_dms(gps_data['GPSLongitude'], gps_data['GPSLongitudeRef'])
    else:
        lon = None
    # Extract direction if available
    if 'GPSImgDirection' in gps_data:
        direction = gps_data['GPSImgDirection']
        if hasattr(direction, '__iter__') and not isinstance(direction, str):
            direction = float(direction[0]) / float(direction[1])
        else:
            direction = float(direction)
    # Print results
    print(f"\nExtracted Position: {lat}, {lon}")
    if direction is not None:
        print(f"Extracted Direction: {direction} degrees from North")
    else:
        print("No direction info found.")

def main():
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    jpg_path = os.path.join(workspace_root, "data/images/20231024_085412.jpg")
    print_jpg_gps_direction(jpg_path)

if __name__ == "__main__":
    main() 