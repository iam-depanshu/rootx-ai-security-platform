resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "lab_bucket" {
  bucket = "rootx-lab-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "lab_block" {
  bucket = aws_s3_bucket.lab_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}
