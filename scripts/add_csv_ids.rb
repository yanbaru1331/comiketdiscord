#!/usr/bin/env ruby

require 'csv'
require 'securerandom'

path = ARGV.fetch(0, 'test.csv')
table = CSV.read(path, headers: true)
headers = table.headers.map { |header| header == 'FALSE' ? '購入対象' : header }
headers << 'ID' unless headers.include?('ID')

seen = {}
rows = table.map do |row|
  values = row.to_h
  id = values['ID']&.strip
  id = nil unless id&.match?(/\A[0-9a-f]{16}\z/i)

  begin
    id ||= SecureRandom.hex(8)
  end while seen[id]

  seen[id] = true
  headers.map do |header|
    next id if header == 'ID'
    next values['購入対象'] || values['FALSE'] if header == '購入対象'

    values[header]
  end
end

CSV.open(path, 'w', write_headers: true, headers: headers) do |csv|
  rows.each { |row| csv << row }
end
