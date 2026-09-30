package com.pedidos360.report.service;

import com.pedidos360.report.exception.InvalidRangeException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Rangos relativos del caso: last24h, last7d, last30d... (h = horas, d = dias; maximo 365 dias). */
public record ReportRange(String name, LocalDateTime from, LocalDateTime to) {

	private static final Pattern PATTERN = Pattern.compile("^last(\\d{1,4})([hd])$");
	private static final Duration MAX = Duration.ofDays(365);

	public static ReportRange parse(String range, LocalDateTime now) {
		Matcher m = PATTERN.matcher(range == null ? "" : range.trim().toLowerCase());
		if (!m.matches()) {
			throw new InvalidRangeException("Rango invalido '" + range + "'. Usa lastNh o lastNd, p. ej. last24h o last7d");
		}
		long amount = Long.parseLong(m.group(1));
		Duration duration = "h".equals(m.group(2)) ? Duration.ofHours(amount) : Duration.ofDays(amount);
		if (amount == 0 || duration.compareTo(MAX) > 0) {
			throw new InvalidRangeException("El rango debe estar entre 1 hora y 365 dias");
		}
		return new ReportRange(range.trim().toLowerCase(), now.minus(duration), now);
	}
}
