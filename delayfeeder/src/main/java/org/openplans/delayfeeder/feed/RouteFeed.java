/* Copyright 2010, OpenPlans
 
 This program is free software: you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation, either version 3 of
 the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>. */

package org.openplans.delayfeeder.feed;

import java.io.Serializable;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToMany;
import javax.persistence.Table;

@Entity
@Table(name = "route_feed")
@org.hibernate.annotations.Entity(mutable = true)
public class RouteFeed implements Serializable {
	@Id
	@GeneratedValue
	private long id;
	
	public String url;
	public String agency;
	public String route;
	public Calendar lastFetched;
	public Calendar lastEntry;

    /*@OneToMany(cascade=CascadeType.ALL)
    @JoinColumn(name="feed", referencedColumnName = "id")*/
    @OneToMany(mappedBy="feed", fetch=FetchType.LAZY)
    public Set<RouteFeedItem> items = new HashSet<RouteFeedItem>();
    
	public long getId() {
		return id;
	}
}
