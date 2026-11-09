/*
 *  ModernUI theme for ruTorrent
 *  A modern Bootstrap 5 based UI built on top of the MaterialDesign icon set.
 *
 *  Original MaterialDesign theme: Phlo / LesBleus (Oblivion)
 *  Icons: small-n-flat by paomedia (CC0 1.0)
 */

/* Slightly taller rows give the table a calmer, more modern rhythm. */
TR_HEIGHT = 30;

plugin.modernuiAllDone = plugin.allDone;
plugin.allDone = function()
{
	plugin.modernuiAllDone.call(this);

	/* Progress bars of the storage / load plugins follow the theme accent. */
	$.each(["diskspace", "quotaspace", "cpuload"], function(ndx, name)
	{
		var plg = thePlugins.get(name);
		if (plg && plg.enabled)
		{
			plg.prgStartColor = new RGBackground("#34d399");
			plg.prgEndColor = new RGBackground("#fb7185");
		}
	});
};

plugin.oldTableCreate = dxSTable.prototype.create;
dxSTable.prototype.create = function(ele, styles, aName)
{
	plugin.oldTableCreate.call(this, ele, styles, aName);
	this.prgStartColor = new RGBackground("#6366f1");
	this.prgEndColor = new RGBackground("#22d3ee");
};

/* Dragging a column changes the cell width without a window resize; re-run
   the label pass once the core has applied the new widths. */
if (typeof dxSTable.prototype.resizeColumn === "function")
{
	plugin.oldResizeColumn = dxSTable.prototype.resizeColumn;
	dxSTable.prototype.resizeColumn = function()
	{
		var result = plugin.oldResizeColumn.apply(this, arguments);
		if (typeof plugin.modernuiAlignMeters === "function")
			plugin.modernuiAlignMeters();
		return result;
	};
}

/* Progress labels ----------------------------------------------------------
   ruTorrent centres the percentage across the whole cell while the coloured
   bar only covers the completed part. Move the label over the bar instead.
   It stays the cell's first child, so the core keeps updating it in place. */
(function()
{
	"use strict";

	var watched = (typeof WeakSet === "function") ? new WeakSet() : null;
	var resizer = (typeof ResizeObserver === "function") ? new ResizeObserver(function(entries)
	{
		for (var i = 0; i < entries.length; i++)
		{
			var target = entries[i].target;
			/* The cell is watched as well as the bar so dragging a column
			   realigns zero-percent rows, whose bar never changes width. */
			alignCell(target.tagName === "TD" ? target : target.parentElement);
		}
	}) : null;

	function isMeter(node)
	{
		return !!node && node.nodeType === 1 && node.classList &&
			(node.classList.contains("meter-text") || node.classList.contains("meter-value"));
	}

	function alignCell(td)
	{
		if (!td || td.nodeType !== 1)
			return;
		var label = td.querySelector(":scope > .meter-text");
		var bar = td.querySelector(":scope > .meter-value");
		if (!label || !bar)
			return;
		var available = td.clientWidth;
		/* Measure the label at its natural size, then shrink it to the column.
		   getBoundingClientRect() includes the scale we may have applied
		   earlier, so undo it before calculating the next scale. */
		var applied = parseFloat(label.style.getPropertyValue("--meter-scale")) || 1;
		var natural = label.getBoundingClientRect().width / applied;
		var scale = 1;
		if (natural > 0 && available > 0)
		{
			scale = Math.min(1, (available - 1) / natural);
			scale = (scale < 1) ? Math.max(0.65, scale) : 1;
			var scaleValue = scale.toFixed(3);
			if (scale < 1)
			{
				if (label.style.getPropertyValue("--meter-scale") !== scaleValue)
					label.style.setProperty("--meter-scale", scaleValue);
			}
			else if (label.style.getPropertyValue("--meter-scale"))
				label.style.removeProperty("--meter-scale");
			/* Below the minimum scale the label is allowed to spill over the
			   cell edge rather than disappear behind the overflow clip. */
			td.classList.toggle("meter-overflow", natural > available - 1);
		}
		else
		{
			label.style.removeProperty("--meter-scale");
			td.classList.remove("meter-overflow");
		}
		var barWidth = bar.getBoundingClientRect().width;
		if (barWidth <= 0)
		{
			/* Empty or hidden bar: fall back to the centred default. */
			if (label.style.left)
				label.style.left = "";
			label.classList.remove("meter-text-onbar");
			return;
		}
		var half = natural * scale / 2;
		var centre = barWidth / 2;
		if ((half * 2) >= available)
			centre = available / 2;
		else
			centre = Math.min(Math.max(centre, half), available - half);
		var value = centre.toFixed(2) + "px";
		if (label.style.left !== value)
			label.style.left = value;
		/* Let the theme pick a contrasting colour: white over the bar, dark on
		   the track when a short bar keeps the label outside it. */
		var overBar = (centre + half) <= (barWidth + 0.5);
		label.classList.toggle("meter-text-onbar", overBar);
	}

	function watch(bar)
	{
		if (watched)
		{
			if (watched.has(bar))
				return;
			watched.add(bar);
		}
		if (resizer)
		{
			resizer.observe(bar);
			if (bar.parentElement)
				resizer.observe(bar.parentElement);
			/* The label can change width when a font loads or its text grows,
			   which changes how far it may travel inside the cell. */
			var label = bar.parentElement && bar.parentElement.querySelector(":scope > .meter-text");
			if (label)
				resizer.observe(label);
		}
		alignCell(bar.parentElement);
	}

	function unwatch(bar)
	{
		if (!resizer)
			return;
		resizer.unobserve(bar);
		if (bar.parentElement)
			resizer.unobserve(bar.parentElement);
		var label = bar.parentElement && bar.parentElement.querySelector(":scope > .meter-text");
		if (label)
			resizer.unobserve(label);
	}

	function scan(root)
	{
		if (!root || root.nodeType !== 1)
			return;
		if (isMeter(root) && root.classList.contains("meter-value"))
			watch(root);
		if (root.querySelectorAll)
		{
			var bars = root.querySelectorAll(".meter-value");
			for (var i = 0; i < bars.length; i++)
				watch(bars[i]);
		}
	}

	function start()
	{
		if (typeof MutationObserver === "function")
		{
			new MutationObserver(function(mutations)
			{
				for (var i = 0; i < mutations.length; i++)
				{
					var m = mutations[i];
					if (m.type === "attributes")
					{
						if (isMeter(m.target))
							alignCell(m.target.parentElement);
					}
					else if (m.type === "childList")
					{
						var target = m.target;
						var el = (target.nodeType === 1) ? target : target.parentElement;
						if (isMeter(el))
							alignCell(el.parentElement);
						for (var j = 0; j < m.addedNodes.length; j++)
							scan(m.addedNodes[j]);
						/* Rows scrolled out of view are dropped from the DOM. Stop
						   observing their bars so detached rows can be collected. */
						if (resizer)
						{
							for (var k = 0; k < m.removedNodes.length; k++)
							{
								var gone = m.removedNodes[k];
								if (gone.nodeType !== 1)
									continue;
								if (isMeter(gone) && gone.classList.contains("meter-value"))
									unwatch(gone);
								if (gone.querySelectorAll)
								{
									var goneBars = gone.querySelectorAll(".meter-value");
									for (var n = 0; n < goneBars.length; n++)
										unwatch(goneBars[n]);
								}
							}
						}
					}
				}
			}).observe(document.documentElement, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["style"]
			});
		}
		scan(document.body || document.documentElement);
		alignAll();
		/* Web fonts can arrive after the first paint and widen the label. */
		if (document.fonts && document.fonts.ready)
			document.fonts.ready.then(alignAll);
		window.addEventListener("resize", alignAll);
	}

	function alignAll()
	{
		var bars = document.querySelectorAll(".meter-value");
		for (var i = 0; i < bars.length; i++)
			alignCell(bars[i].parentElement);
	}

	/* Reused by the column-resize hook above. */
	plugin.modernuiAlignMeters = alignAll;

	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", start);
	else
		start();
})();
